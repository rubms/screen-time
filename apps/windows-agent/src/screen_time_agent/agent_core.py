"""Main enforcement loop wiring watcher, rules, UI, and closer."""

from __future__ import annotations

import logging
import queue
import sys
import threading
import time
from datetime import date, datetime
from screen_time_agent.browser_reader import read_browser_url
from screen_time_agent.closer import CloseTarget, Closer
from screen_time_agent.clock_monitor import ClockMonitor
from screen_time_agent.config import DeviceConfig, load_config
from screen_time_agent.firestore_client import FirestoreClient
from screen_time_agent.foreground_watcher import FocusEvent, ForegroundWatcher
from screen_time_agent.local_state_store import LocalStateStore
from screen_time_agent.mock_foreground_watcher import MockForegroundWatcher
from screen_time_agent.paths import rules_cache_path
from screen_time_agent.updater import Updater
from screen_time_agent.warning_ui import WarningUI
from screen_time_rules import decide
from screen_time_rules.models import (
    UNKNOWN_TARGET_ID,
    Activity,
    Decision,
    DecisionBlocked,
    DecisionOutOfTime,
    DecisionOutsideSchedule,
    NowLocal,
    Rules,
    TempUnlock,
    UsageToday,
    now_local_from_datetime,
)

logger = logging.getLogger(__name__)


class AgentCore:
    def __init__(self) -> None:
        self._store = LocalStateStore()
        self._focus_queue: queue.Queue[FocusEvent] = queue.Queue()
        self._watcher: ForegroundWatcher | MockForegroundWatcher
        if sys.platform == "win32":
            self._watcher = ForegroundWatcher(self._focus_queue)
        else:
            self._watcher = MockForegroundWatcher(self._focus_queue)
        self._rules: Rules | None = None
        self._unlocks: list[TempUnlock] = []
        self._current_app = ""
        self._current_url: str | None = None
        self._current_target_id = UNKNOWN_TARGET_ID
        self._stop = threading.Event()
        self._tick_thread: threading.Thread | None = None
        self._focus_thread: threading.Thread | None = None
        self._warning_ui = WarningUI()
        self._closer = Closer()
        self._clock = ClockMonitor(on_tamper=self._on_clock_tamper)
        self._cfg: DeviceConfig | None = None
        self._firestore = FirestoreClient(
            self._store,
            on_rules=self._on_rules,
            on_unlocks=self._on_unlocks,
        )
        self._updater = Updater(installed_version="0.1.0")
        self._last_decision: Decision | None = None
        self._mono_usage_anchor = time.monotonic()

        self._warning_ui.set_grace_callback(self._on_grace_expired)

    def start(self) -> None:
        self._cfg = load_config()
        self._load_rules_from_disk()
        self._unlocks = self._store.load_unlocks()
        self._watcher.start()
        self._clock.start()
        self._firestore.start()
        self._updater.start()
        self._firestore.emit({"type": "agent-start", "at": datetime.utcnow().isoformat()})
        self._stop.clear()
        self._focus_thread = threading.Thread(target=self._focus_loop, daemon=True)
        self._tick_thread = threading.Thread(target=self._tick_loop, daemon=True)
        self._focus_thread.start()
        self._tick_thread.start()
        logger.info("agent core started")

    def stop(self) -> None:
        self._stop.set()
        self._watcher.stop()
        self._clock.stop()
        self._firestore.emit({"type": "agent-stop", "at": datetime.utcnow().isoformat()})
        self._firestore.stop()
        self._updater.stop()

    def _load_rules_from_disk(self) -> None:
        path = rules_cache_path()
        if path.exists():
            self._rules = Rules.model_validate_json(path.read_text(encoding="utf-8"))
        else:
            self._rules = _default_rules()

    def _on_rules(self, rules: Rules) -> None:
        self._rules = rules

    def _on_unlocks(self, unlocks: list[TempUnlock]) -> None:
        self._unlocks = unlocks

    def _on_clock_tamper(self) -> None:
        self._firestore.emit({"type": "tamper-attempt", "tamperKind": "clock-tamper-suspected"})

    def _focus_loop(self) -> None:
        while not self._stop.is_set():
            try:
                evt = self._focus_queue.get(timeout=1.0)
            except queue.Empty:
                continue
            if evt.previous_app:
                self._emit_focus_end(evt.previous_app, evt.previous_duration_ms)
            self._current_app = evt.current_app
            self._current_url = read_browser_url(evt.current_app)
            self._emit_focus_start(evt.current_app, self._current_url)

    def _tick_loop(self) -> None:
        while not self._stop.wait(1.0):
            self._warning_ui.reset_daily()
            self._evaluate()

    def _evaluate(self) -> None:
        if not self._rules or not self._current_app:
            return
        activity = Activity(app=self._current_app, url=self._current_url, platform="windows")
        raw_usage = self._store.get_usage_today()
        usage = UsageToday(
            totalLimitedMinutes=sum(raw_usage.values()),
            perTarget=raw_usage,
        )
        decision = decide(
            activity,
            self._rules,
            usage,
            now_local_from_datetime(datetime.now()),
            self._unlocks,
        )
        self._last_decision = decision
        target_id, display = self._resolve_display(activity)
        self._current_target_id = target_id
        grace = self._rules.defaults.grace_period_seconds
        skip_grace = self._closer.in_cooldown(f"{self._current_app}:{self._current_url or ''}")

        if isinstance(decision, DecisionBlocked):
            self._closer.close(
                CloseTarget(app=self._current_app, url=self._current_url),
                immediate=True,
            )
            return

        if isinstance(decision, (DecisionOutOfTime, DecisionOutsideSchedule)):
            self._warning_ui.handle_decision(
                decision,
                target_id=target_id,
                display_name=display,
                grace_seconds=grace,
                skip_grace=skip_grace,
            )
            if skip_grace:
                self._closer.close(
                    CloseTarget(app=self._current_app, url=self._current_url),
                    immediate=True,
                )
            return

        from screen_time_rules.models import DecisionWarn

        if isinstance(decision, DecisionWarn):
            self._warning_ui.handle_decision(
                decision,
                target_id=target_id,
                display_name=display,
                grace_seconds=grace,
            )

        self._accumulate_usage(target_id)

    def _accumulate_usage(self, target_id: str) -> None:
        self._store.add_usage_minutes(target_id, 1.0 / 60.0)

    def _on_grace_expired(self) -> None:
        self._firestore.emit(
            {
                "type": "force-close",
                "app": self._current_app,
                "url": self._current_url,
                "targetId": self._current_target_id,
            }
        )
        self._closer.close(CloseTarget(app=self._current_app, url=self._current_url))

    def _emit_focus_start(self, app: str, url: str | None) -> None:
        self._firestore.emit(
            {
                "type": "focus-start",
                "app": app,
                "url": url,
                "targetId": self._current_target_id,
                "localDate": date.today().isoformat(),
            }
        )

    def _emit_focus_end(self, app: str, duration_ms: int) -> None:
        self._firestore.emit(
            {
                "type": "focus-end",
                "app": app,
                "durationMs": duration_ms,
                "localDate": date.today().isoformat(),
            }
        )

    def _resolve_display(self, activity: Activity) -> tuple[str, str]:
        return self._current_target_id, activity.app

    @property
    def last_decision(self) -> Decision | None:
        return self._last_decision


def _default_rules() -> Rules:
    weekly = {}
    for dow in ("mon", "tue", "wed", "thu", "fri", "sat", "sun"):
        weekly[dow] = {
            "schedule": [{"start": "08:00", "end": "22:00"}],
            "dailyTotalMinutes": 180,
        }
    return Rules.model_validate(
        {
            "version": 1,
            "weekly": weekly,
            "defaults": {"warningLeadMinutes": 5, "gracePeriodSeconds": 120},
            "targets": [],
        }
    )

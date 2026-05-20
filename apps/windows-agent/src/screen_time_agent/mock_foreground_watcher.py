"""Mock foreground watcher for non-Windows debug-run."""

from __future__ import annotations

import logging
import queue
import threading
import time
from datetime import datetime, timezone

from screen_time_agent.foreground_watcher import FocusEvent

logger = logging.getLogger(__name__)


class MockForegroundWatcher:
    """Cycles through sample apps for local development."""

    def __init__(self, out_queue: queue.Queue[FocusEvent]) -> None:
        self._queue = out_queue
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._apps = ["chrome.exe", "notepad.exe", "msedge.exe"]
        self._index = 0
        self._last_app: str | None = None
        self._focus_started = time.monotonic()

    def start(self) -> None:
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name="MockForegroundWatcher", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=3)

    def _run(self) -> None:
        while not self._stop.wait(3.0):
            app = self._apps[self._index % len(self._apps)]
            self._index += 1
            now_mono = time.monotonic()
            duration_ms = int((now_mono - self._focus_started) * 1000)
            self._queue.put(
                FocusEvent(
                    previous_app=self._last_app,
                    current_app=app,
                    current_title=f"Mock {app}",
                    previous_duration_ms=duration_ms if self._last_app else 0,
                    at=datetime.now(timezone.utc),
                )
            )
            self._last_app = app
            self._focus_started = now_mono
            logger.debug("mock focus -> %s", app)

"""Toast warnings and topmost Tkinter grace modal."""

from __future__ import annotations

import logging
import sys
import threading
from datetime import date
from typing import Callable

from screen_time_rules.models import Decision, DecisionOutOfTime, DecisionOutsideSchedule, DecisionWarn

logger = logging.getLogger(__name__)


class WarningUI:
    def __init__(self) -> None:
        self._warned_today: set[tuple[str, int]] = set()
        self._modal_thread: threading.Thread | None = None
        self._on_grace_expired: Callable[[], None] | None = None

    def set_grace_callback(self, cb: Callable[[], None]) -> None:
        self._on_grace_expired = cb

    def handle_decision(
        self,
        decision: Decision,
        *,
        target_id: str,
        display_name: str,
        grace_seconds: int,
        skip_grace: bool = False,
    ) -> None:
        if isinstance(decision, DecisionWarn):
            threshold = int(decision.remaining_minutes)
            key = (target_id, threshold)
            if key in self._warned_today:
                return
            self._warned_today.add(key)
            self._show_toast(f"{threshold} minutes left on {display_name}")
        elif isinstance(decision, (DecisionOutOfTime, DecisionOutsideSchedule)):
            if skip_grace:
                self._show_toast("Outside allowed hours" if isinstance(decision, DecisionOutsideSchedule) else "Time is up")
                if self._on_grace_expired:
                    self._on_grace_expired()
            else:
                self._show_modal(grace_seconds, display_name)

    def reset_daily(self) -> None:
        today = date.today()
        self._warned_today = {k for k in self._warned_today if True}
        if not hasattr(self, "_warn_day") or self._warn_day != today:
            self._warned_today.clear()
            self._warn_day = today

    def _show_toast(self, message: str) -> None:
        if sys.platform != "win32":
            logger.info("toast: %s", message)
            return
        try:
            self._win_toast(message)
        except Exception:
            logger.info("toast fallback: %s", message)

    def _win_toast(self, message: str) -> None:
        import winrt.windows.ui.notifications as notifications  # type: ignore[import-untyped]

        notifier = notifications.ToastNotificationManager.create_toast_notifier("Screen Time Control")
        xml = notifications.ToastNotificationManager.get_template_content(
            notifications.ToastTemplateType.TOAST_TEXT01
        )
        text_nodes = xml.get_elements_by_tag_name("text")
        if text_nodes.size > 0:
            text_nodes.item(0).append_child(xml.create_text_node(message))
        notifier.show(notifications.ToastNotification(xml))

    def _show_modal(self, grace_seconds: int, display_name: str) -> None:
        if self._modal_thread and self._modal_thread.is_alive():
            return
        self._modal_thread = threading.Thread(
            target=self._run_modal,
            args=(grace_seconds, display_name),
            daemon=True,
        )
        self._modal_thread.start()

    def _run_modal(self, grace_seconds: int, display_name: str) -> None:
        try:
            import tkinter as tk
        except ImportError:
            logger.warning("tkinter unavailable")
            if self._on_grace_expired:
                self._on_grace_expired()
            return

        root = tk.Tk()
        root.withdraw()
        top = tk.Toplevel(root)
        top.title("Screen Time")
        top.attributes("-topmost", True)
        top.resizable(False, False)
        label = tk.Label(top, text="", font=("Segoe UI", 14))
        label.pack(padx=24, pady=24)
        remaining = [grace_seconds]

        def tick() -> None:
            if remaining[0] <= 0:
                top.destroy()
                root.quit()
                if self._on_grace_expired:
                    self._on_grace_expired()
                return
            label.config(text=f"{display_name}: closing in {remaining[0]}s")
            remaining[0] -= 1
            top.after(1000, tick)

        tick()
        root.mainloop()

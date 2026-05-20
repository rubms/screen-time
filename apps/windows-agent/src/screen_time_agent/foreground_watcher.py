"""Poll foreground window at 1 Hz (Windows)."""

from __future__ import annotations

import logging
import queue
import sys
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone

import psutil

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class FocusEvent:
    previous_app: str | None
    current_app: str
    current_title: str
    previous_duration_ms: int
    at: datetime


class ForegroundWatcher:
    """Dedicated thread polling foreground window once per second."""

    def __init__(self, out_queue: queue.Queue[FocusEvent]) -> None:
        self._queue = out_queue
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._last_app: str | None = None
        self._last_title: str = ""
        self._focus_started = time.monotonic()

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name="ForegroundWatcher", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=3)

    def _run(self) -> None:
        while not self._stop.wait(1.0):
            try:
                app, title = self._read_foreground()
            except Exception:
                logger.exception("foreground read failed")
                continue
            now_mono = time.monotonic()
            if app != self._last_app:
                duration_ms = int((now_mono - self._focus_started) * 1000)
                evt = FocusEvent(
                    previous_app=self._last_app,
                    current_app=app,
                    current_title=title,
                    previous_duration_ms=duration_ms if self._last_app else 0,
                    at=datetime.now(timezone.utc),
                )
                self._queue.put(evt)
                self._last_app = app
                self._focus_started = now_mono
                self._last_title = title

    def _read_foreground(self) -> tuple[str, str]:
        if sys.platform != "win32":
            return "unknown.exe", ""
        import win32gui
        import win32process

        hwnd = win32gui.GetForegroundWindow()
        if not hwnd:
            return "unknown.exe", ""
        title = win32gui.GetWindowText(hwnd) or ""
        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        try:
            name = psutil.Process(pid).name()
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            name = "unknown.exe"
        return name.lower(), title

"""Force-close offending apps/tabs."""

from __future__ import annotations

import logging
import sys
import threading
import time
from dataclasses import dataclass

logger = logging.getLogger(__name__)

REBLOCK_COOLDOWN_SEC = 60


@dataclass
class CloseTarget:
    app: str
    url: str | None = None
    pid: int | None = None


class Closer:
    def __init__(self) -> None:
        self._cooldown: dict[str, float] = {}
        self._lock = threading.Lock()

    def in_cooldown(self, key: str) -> bool:
        with self._lock:
            until = self._cooldown.get(key)
            return until is not None and time.monotonic() < until

    def mark_closed(self, key: str) -> None:
        with self._lock:
            self._cooldown[key] = time.monotonic() + REBLOCK_COOLDOWN_SEC

    def close(self, target: CloseTarget, *, immediate: bool = False) -> None:
        key = f"{target.app}:{target.url or ''}"
        if sys.platform != "win32":
            logger.info("close requested (mock): %s", target)
            self.mark_closed(key)
            return

        if target.url and target.app.lower() in ("chrome.exe", "msedge.exe", "firefox.exe"):
            if self._close_browser_tab():
                self.mark_closed(key)
                return

        self._close_process(target, immediate=immediate)
        self.mark_closed(key)

    def _close_browser_tab(self) -> bool:
        try:
            import win32api
            import win32con
            import win32gui

            hwnd = win32gui.GetForegroundWindow()
            if not hwnd:
                return False
            win32api.PostMessage(hwnd, win32con.WM_CLOSE, 0, 0)
            return True
        except Exception:
            logger.debug("tab close via WM_CLOSE failed", exc_info=True)
            return False

    def _close_process(self, target: CloseTarget, *, immediate: bool) -> None:
        import win32api
        import win32con
        import win32gui
        import win32process

        hwnd = win32gui.GetForegroundWindow()
        if not hwnd:
            return
        win32api.PostMessage(hwnd, win32con.WM_CLOSE, 0, 0)
        if immediate:
            self._terminate_foreground(hwnd)
            return

        def delayed() -> None:
            time.sleep(3.0)
            self._terminate_foreground(hwnd)

        threading.Thread(target=delayed, daemon=True).start()

    def _terminate_foreground(self, hwnd: int) -> None:
        import win32api
        import win32con
        import win32process

        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        handle = win32api.OpenProcess(win32con.PROCESS_TERMINATE, False, pid)
        if handle:
            try:
                win32api.TerminateProcess(handle, 1)
            finally:
                win32api.CloseHandle(handle)

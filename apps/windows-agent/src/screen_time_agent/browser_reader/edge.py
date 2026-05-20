"""Microsoft Edge address bar reader."""

from __future__ import annotations

import sys

from screen_time_agent.browser_reader.base import read_address_bar_value


class EdgeReader:
    def read_url(self, hwnd: int | None = None) -> str | None:
        if sys.platform != "win32":
            return None
        hwnd = hwnd or _foreground_hwnd()
        return read_address_bar_value(
            hwnd,
            automation_ids=["view_1012", "omnibox"],
            names=["Address and search bar", "Address bar"],
        )


def _foreground_hwnd() -> int | None:
    import win32gui

    return win32gui.GetForegroundWindow() or None

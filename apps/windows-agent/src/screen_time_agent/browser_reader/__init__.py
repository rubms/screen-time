"""Browser URL readers via UI Automation."""

from __future__ import annotations

import logging
import sys
import time
from typing import Protocol

from screen_time_agent.browser_reader.chrome import ChromeReader
from screen_time_agent.browser_reader.edge import EdgeReader
from screen_time_agent.browser_reader.firefox import FirefoxReader

logger = logging.getLogger(__name__)

_BROWSER_READERS: dict[str, type] = {
    "chrome.exe": ChromeReader,
    "msedge.exe": EdgeReader,
    "firefox.exe": FirefoxReader,
}

_last_url_fail: dict[str, float] = {}


class BrowserReader(Protocol):
    def read_url(self, hwnd: int | None = None) -> str | None: ...


def get_reader_for_app(app: str) -> BrowserReader | None:
    cls = _BROWSER_READERS.get(app.lower())
    if cls is None:
        return None
    try:
        return cls()
    except Exception:
        logger.debug("browser reader init failed for %s", app, exc_info=True)
        return None


def read_browser_url(app: str, hwnd: int | None = None) -> str | None:
    reader = get_reader_for_app(app)
    if reader is None:
        return None
    try:
        return reader.read_url(hwnd)
    except Exception:
        _emit_url_read_failed(app)
        return None


def _emit_url_read_failed(browser: str) -> None:
    now = time.monotonic()
    last = _last_url_fail.get(browser, 0.0)
    if now - last < 60.0:
        return
    _last_url_fail[browser] = now
    logger.warning("url-read-failed for %s", browser)

"""Browser reader graceful fallback."""

from __future__ import annotations

from screen_time_agent.browser_reader import get_reader_for_app, read_browser_url


def test_unknown_browser_returns_none() -> None:
    assert get_reader_for_app("notepad.exe") is None
    assert read_browser_url("notepad.exe") is None


def test_chrome_reader_off_platform() -> None:
    from screen_time_agent.browser_reader.chrome import ChromeReader

    reader = ChromeReader()
    assert reader.read_url() is None

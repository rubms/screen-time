from __future__ import annotations

from screen_time_rules.models import Platform

BROWSER_MATCHERS: dict[Platform, set[str]] = {
    "windows": {
        "chrome.exe",
        "msedge.exe",
        "firefox.exe",
        "brave.exe",
        "opera.exe",
    },
    "android": {
        "com.android.chrome",
        "com.microsoft.emmx",
        "org.mozilla.firefox",
        "com.brave.browser",
        "com.opera.browser",
    },
}


def is_browser_app(app: str, platform: Platform) -> bool:
    return app.lower() in BROWSER_MATCHERS[platform]

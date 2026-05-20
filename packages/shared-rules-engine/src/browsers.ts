import type { Platform } from "./types.js";

const BROWSER_MATCHERS: Record<Platform, Set<string>> = {
  windows: new Set([
    "chrome.exe",
    "msedge.exe",
    "firefox.exe",
    "brave.exe",
    "opera.exe",
  ]),
  android: new Set([
    "com.android.chrome",
    "com.microsoft.emmx",
    "org.mozilla.firefox",
    "com.brave.browser",
    "com.opera.browser",
  ]),
};

export function isBrowserApp(app: string, platform: Platform): boolean {
  const normalized = app.toLowerCase();
  return BROWSER_MATCHERS[platform].has(normalized);
}

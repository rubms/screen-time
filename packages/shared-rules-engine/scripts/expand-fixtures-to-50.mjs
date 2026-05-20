#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decide } from "../dist/decide.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(root, "fixtures/cases.json");
const data = JSON.parse(readFileSync(path, "utf8"));

const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const weeklyOpen = Object.fromEntries(
  days.map((d) => [d, { schedule: [{ start: "09:00", end: "20:00" }], dailyTotalMinutes: 90 }]),
);
const weeklyClosed = Object.fromEntries(
  days.map((d) => [d, { schedule: [], dailyTotalMinutes: null }]),
);

let n = 0;
while (data.cases.length < 52) {
  const dow = days[n % 7];
  const minutes = [480, 540, 600, 1170, 1350, 0, 30][n % 7];
  const rules = {
    version: 1,
    defaults: { warningLeadMinutes: 5, gracePeriodSeconds: 120 },
    weekly: n % 3 === 0 ? weeklyClosed : weeklyOpen,
    targets:
      n % 5 === 0
        ? [
            {
              kind: "url",
              id: "wiki",
              displayName: "Wiki",
              pattern: "*.wikipedia.org",
              category: "ALLOWED",
            },
          ]
        : [],
  };
  const activity = {
    app: n % 2 === 0 ? "chrome.exe" : "game.exe",
    url: n % 2 === 0 ? "en.wikipedia.org/wiki/Test" : undefined,
    platform: "windows",
  };
  const usage = {
    totalLimitedMinutes: (n % 4) * 20,
    perTarget: { chrome: n % 3 === 1 ? 25 : 0 },
  };
  const nowLocal = {
    localDate: "2026-05-19",
    dayOfWeek: dow,
    minutesSinceMidnight: minutes,
    epochMs: 1_000_000 + n,
  };
  const tempUnlocks =
    n % 11 === 0
      ? [
          {
            id: `u${n}`,
            deviceId: "d1",
            scope: "schedule+quotas",
            expiresAtMs: 9_999_999,
            revoked: false,
          },
        ]
      : [];
  const expected = decide(activity, rules, usage, nowLocal, tempUnlocks);
  data.cases.push({
    id: `auto-${dow}-${minutes}-${n}`,
    activity,
    rules,
    usage,
    nowLocal,
    tempUnlocks,
    expected,
  });
  n++;
}

writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
console.log(`fixtures: ${data.cases.length} cases`);

import { describe, expect, it } from "vitest";
import { decide } from "./decide.js";
import type { Activity, DayOfWeek, Rules, UsageToday } from "./types.js";

const weekly = (dailyTotal: number | null) => {
  const days: DayOfWeek[] = [
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
    "sat",
    "sun",
  ];
  return Object.fromEntries(
    days.map((d) => [
      d,
      {
        schedule: [{ start: "09:00", end: "20:00" }],
        dailyTotalMinutes: dailyTotal,
      },
    ]),
  ) as Rules["weekly"];
};

const baseRules = (targets: Rules["targets"] = []): Rules => ({
  version: 1,
  defaults: { warningLeadMinutes: 5, gracePeriodSeconds: 120 },
  weekly: weekly(120),
  targets,
});

const now = (dow: DayOfWeek, minutes: number) => ({
  localDate: "2026-05-19",
  dayOfWeek: dow,
  minutesSinceMidnight: minutes,
  epochMs: 1_000_000,
});

describe("decide edge cases", () => {
  const days: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

  for (const dow of days) {
    it(`allows LIMITED inside schedule on ${dow}`, () => {
      const activity: Activity = {
        app: "game.exe",
        platform: "windows",
      };
      const d = decide(
        activity,
        baseRules(),
        { totalLimitedMinutes: 0, perTarget: {} },
        now(dow, 12 * 60),
      );
      expect(d.kind).toBe("LIMITED_OK");
    });
  }

  it("wildcard wikipedia subdomain", () => {
    const rules = baseRules([
      {
        kind: "url",
        id: "wiki",
        displayName: "Wikipedia",
        pattern: "*.wikipedia.org",
        category: "ALLOWED",
      },
    ]);
    const d = decide(
      {
        app: "chrome.exe",
        url: "https://en.wikipedia.org/wiki/Cat",
        platform: "windows",
      },
      rules,
      { totalLimitedMinutes: 0, perTarget: {} },
      now("tue", 600),
    );
    expect(d).toEqual({ kind: "ALLOWED" });
  });

  it("schedule+quotas unlock bypasses exhausted quota", () => {
    const rules = baseRules([
      {
        kind: "app",
        id: "chrome",
        displayName: "Chrome",
        platform: "windows",
        matchers: [{ platform: "windows", matcher: "chrome.exe" }],
        category: "LIMITED",
        dailyQuotaMinutes: { default: 1 },
      },
    ]);
    const d = decide(
      { app: "chrome.exe", platform: "windows" },
      rules,
      { totalLimitedMinutes: 999, perTarget: { chrome: 60 } },
      now("tue", 600),
      [
        {
          id: "u",
          deviceId: "d",
          scope: "schedule+quotas",
          expiresAtMs: 9_999_999,
          revoked: false,
        },
      ],
    );
    expect(d.kind).toBe("LIMITED_OK");
  });

  it("schedule-only unlock outside window yields unlimited LIMITED_OK", () => {
    const rules = baseRules();
    rules.weekly.tue = { schedule: [], dailyTotalMinutes: null };
    const d = decide(
      { app: "game.exe", platform: "windows" },
      rules,
      { totalLimitedMinutes: 0, perTarget: {} },
      now("tue", 600),
      [
        {
          id: "u",
          deviceId: "d",
          scope: "schedule",
          expiresAtMs: 9_999_999,
          revoked: false,
        },
      ],
    );
    expect(d).toEqual({
      kind: "LIMITED_OK",
      remainingMinutes: 9999,
      warnAt: 9994,
    });
  });

  it("empty sunday schedule blocks LIMITED", () => {
    const rules = baseRules();
    rules.weekly.sun = { schedule: [], dailyTotalMinutes: null };
    const d = decide(
      { app: "game.exe", platform: "windows" },
      rules,
      { totalLimitedMinutes: 0, perTarget: {} },
      now("sun", 600),
    );
    expect(d).toEqual({ kind: "OUTSIDE_SCHEDULE" });
  });
});

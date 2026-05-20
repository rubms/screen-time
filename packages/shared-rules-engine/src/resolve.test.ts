import { describe, expect, it } from "vitest";
import {
  getGracePeriod,
  getTargetQuotaMinutes,
  getWarningLead,
  resolveActivity,
} from "./resolve.js";
import type { Activity, Rules } from "./types.js";

const baseRules = (): Rules => ({
  version: 1,
  defaults: { warningLeadMinutes: 5, gracePeriodSeconds: 120 },
  weekly: {
    mon: { schedule: [{ start: "09:00", end: "20:00" }], dailyTotalMinutes: 180 },
    tue: { schedule: [{ start: "09:00", end: "20:00" }], dailyTotalMinutes: 180 },
    wed: { schedule: [{ start: "09:00", end: "20:00" }], dailyTotalMinutes: 180 },
    thu: { schedule: [{ start: "09:00", end: "20:00" }], dailyTotalMinutes: 180 },
    fri: { schedule: [{ start: "09:00", end: "20:00" }], dailyTotalMinutes: 180 },
    sat: { schedule: [], dailyTotalMinutes: null },
    sun: { schedule: [], dailyTotalMinutes: null },
  },
  targets: [],
});

describe("resolveActivity", () => {
  it("defaults unknown app to LIMITED __unknown__", () => {
    const activity: Activity = {
      app: "unknown.exe",
      platform: "windows",
    };
    const r = resolveActivity(activity, baseRules());
    expect(r.targetId).toBe("__unknown__");
    expect(r.category).toBe("LIMITED");
  });

  it("BLOCKED app overrides ALLOWED url", () => {
    const rules = baseRules();
    rules.targets = [
      {
        kind: "app",
        id: "chrome",
        displayName: "Chrome",
        platform: "windows",
        matchers: [{ platform: "windows", matcher: "chrome.exe" }],
        category: "BLOCKED",
      },
      {
        kind: "url",
        id: "yt-kids",
        displayName: "YT Kids",
        pattern: "youtube.com/kids/",
        category: "ALLOWED",
      },
    ];
    const r = resolveActivity(
      {
        app: "chrome.exe",
        url: "youtube.com/kids/abc",
        platform: "windows",
      },
      rules,
    );
    expect(r.category).toBe("BLOCKED");
  });

  it("quota prefers weekday override over default", () => {
    const target = {
      kind: "app" as const,
      id: "game",
      displayName: "Game",
      platform: "windows" as const,
      matchers: [{ platform: "windows" as const, matcher: "game.exe" }],
      category: "LIMITED" as const,
      dailyQuotaMinutes: { default: 60, tue: 90 },
    };
    expect(getTargetQuotaMinutes(target, "tue")).toBe(90);
    expect(getTargetQuotaMinutes(target, "mon")).toBe(60);
    expect(getTargetQuotaMinutes(null, "mon")).toBeNull();
  });

  it("warning and grace fall back to defaults", () => {
    const rules = baseRules();
    expect(getWarningLead(null, rules.defaults)).toBe(5);
    expect(getGracePeriod(null, rules.defaults)).toBe(120);
    const target = {
      kind: "app" as const,
      id: "x",
      displayName: "X",
      platform: "windows" as const,
      matchers: [{ platform: "windows" as const, matcher: "x.exe" }],
      category: "LIMITED" as const,
      warningLeadMinutes: 2,
      gracePeriodSeconds: 30,
    };
    expect(getWarningLead(target, rules.defaults)).toBe(2);
    expect(getGracePeriod(target, rules.defaults)).toBe(30);
  });
});

import { describe, expect, it } from "vitest";
import { aggregateEvents, isRollupWindow, type SessionEvent } from "../src/lib/rollup";

describe("rollup aggregation", () => {
  it("aggregates focus-end minutes by category and target", () => {
    const events: SessionEvent[] = [
      {
        eventType: "focus-end",
        at: "2026-05-18T10:00:00Z",
        localDate: "2026-05-18",
        childId: "child1",
        deviceId: "d1",
        targetId: "chrome",
        category: "LIMITED",
        durationMs: 120_000,
      },
      {
        eventType: "focus-end",
        at: "2026-05-18T11:00:00Z",
        localDate: "2026-05-18",
        childId: "child1",
        deviceId: "d1",
        targetId: "notepad",
        category: "ALLOWED",
        durationMs: 60_000,
      },
      {
        eventType: "warning-shown",
        at: "2026-05-18T11:30:00Z",
        localDate: "2026-05-18",
        childId: "child1",
        deviceId: "d1",
        targetId: "chrome",
        category: "LIMITED",
      },
    ];

    const rollup = aggregateEvents(events, "2026-05-18", "child1");
    expect(rollup.totalLimitedMinutes).toBeCloseTo(2);
    expect(rollup.totalAllowedMinutes).toBeCloseTo(1);
    expect(rollup.perTarget.chrome?.minutes).toBeCloseTo(2);
    expect(rollup.perTarget.chrome?.sessions).toBe(1);
    expect(rollup.warnings.chrome).toBe(1);
  });

  it("detects rollup window 00:30-01:00 local", () => {
    const inWindow = new Date("2026-05-18T22:45:00Z"); // 00:45 CEST in Europe/Madrid
    expect(isRollupWindow(inWindow, "Europe/Madrid")).toBe(true);

    const outWindow = new Date("2026-05-19T10:00:00Z");
    expect(isRollupWindow(outWindow, "Europe/Madrid")).toBe(false);
  });
});

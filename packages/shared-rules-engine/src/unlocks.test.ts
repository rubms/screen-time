import { describe, expect, it } from "vitest";
import {
  activeUnlocks,
  computeUnlockEffects,
  mostPermissiveScope,
} from "./unlocks.js";
import type { NowLocal, TempUnlock } from "./types.js";

const now: NowLocal = {
  localDate: "2026-05-19",
  dayOfWeek: "tue",
  minutesSinceMidnight: 600,
  epochMs: 1_000_000,
};

describe("unlocks", () => {
  it("filters expired and revoked", () => {
    const unlocks: TempUnlock[] = [
      { id: "1", deviceId: "d", scope: "schedule", expiresAtMs: 500_000, revoked: false },
      { id: "2", deviceId: "d", scope: "schedule", expiresAtMs: 2_000_000, revoked: false },
      { id: "3", deviceId: "d", scope: "schedule", expiresAtMs: 2_000_000, revoked: true },
    ];
    expect(activeUnlocks(unlocks, now)).toHaveLength(1);
  });

  it("composes schedule and add-minutes", () => {
    const fx = computeUnlockEffects(
      [
        {
          id: "a",
          deviceId: "d",
          scope: "schedule",
          expiresAtMs: 9_999_999,
          revoked: false,
        },
        {
          id: "b",
          deviceId: "d",
          scope: "add-minutes",
          target: "total",
          additionalMinutes: 15,
          expiresAtMs: 9_999_999,
          revoked: false,
        },
      ],
      now,
    );
    expect(fx.bypassSchedule).toBe(true);
    expect(fx.extraTotalMinutes).toBe(15);
  });

  it("mostPermissiveScope picks broadest", () => {
    expect(
      mostPermissiveScope(["add-minutes", "schedule", "schedule+quotas"]),
    ).toBe("schedule+quotas");
    expect(mostPermissiveScope([])).toBeNull();
  });
});

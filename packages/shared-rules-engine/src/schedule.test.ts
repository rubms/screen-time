import { describe, expect, it } from "vitest";
import {
  getActiveWindow,
  isInsideSchedule,
  minutesUntilScheduleWindowEnds,
} from "./schedule.js";
import type { DaySchedule } from "./types.js";

describe("schedule", () => {
  const day: DaySchedule = {
    schedule: [{ start: "09:00", end: "20:00" }],
    dailyTotalMinutes: 120,
  };

  it("inside window", () => {
    expect(isInsideSchedule(day, 600)).toBe(true);
  });

  it("outside window", () => {
    expect(isInsideSchedule(day, 1350)).toBe(false);
  });

  it("empty schedule is never inside", () => {
    expect(isInsideSchedule({ schedule: [], dailyTotalMinutes: null }, 600)).toBe(
      false,
    );
  });

  it("overnight window wrap", () => {
    const overnight: DaySchedule = {
      schedule: [{ start: "22:00", end: "06:00" }],
      dailyTotalMinutes: null,
    };
    expect(isInsideSchedule(overnight, 23 * 60)).toBe(true);
    expect(isInsideSchedule(overnight, 3 * 60)).toBe(true);
    expect(isInsideSchedule(overnight, 12 * 60)).toBe(false);
  });

  it("minutes until end inside window", () => {
    expect(minutesUntilScheduleWindowEnds(day, 19 * 60 + 30)).toBe(30);
  });

  it("minutes until end null when outside", () => {
    expect(minutesUntilScheduleWindowEnds(day, 21 * 60)).toBeNull();
  });

  it("overnight minutes until end after midnight start", () => {
    const overnight: DaySchedule = {
      schedule: [{ start: "22:00", end: "06:00" }],
      dailyTotalMinutes: null,
    };
    expect(minutesUntilScheduleWindowEnds(overnight, 23 * 60)).toBe(7 * 60);
  });

  it("overnight minutes until end before midnight end", () => {
    const overnight: DaySchedule = {
      schedule: [{ start: "22:00", end: "06:00" }],
      dailyTotalMinutes: null,
    };
    expect(minutesUntilScheduleWindowEnds(overnight, 3 * 60)).toBe(3 * 60);
  });

  it("getActiveWindow returns matching window", () => {
    expect(getActiveWindow(day, 10 * 60)).toEqual({
      start: "09:00",
      end: "20:00",
    });
    expect(getActiveWindow(day, 21 * 60)).toBeNull();
  });

  it("getActiveWindow overnight wrap", () => {
    const overnight: DaySchedule = {
      schedule: [{ start: "22:00", end: "06:00" }],
      dailyTotalMinutes: null,
    };
    expect(getActiveWindow(overnight, 23 * 60)?.start).toBe("22:00");
  });
});

import type { DaySchedule, NowLocal, ScheduleWindow } from "./types.js";

function parseHm(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function isInsideSchedule(
  daySchedule: DaySchedule,
  minutesSinceMidnight: number,
): boolean {
  if (!daySchedule.schedule.length) return false;
  for (const w of daySchedule.schedule) {
    const start = parseHm(w.start);
    const end = parseHm(w.end);
    if (start <= end) {
      if (minutesSinceMidnight >= start && minutesSinceMidnight < end) {
        return true;
      }
    } else {
      if (minutesSinceMidnight >= start || minutesSinceMidnight < end) {
        return true;
      }
    }
  }
  return false;
}

export function minutesUntilScheduleWindowEnds(
  daySchedule: DaySchedule,
  minutesSinceMidnight: number,
): number | null {
  if (!daySchedule.schedule.length) return null;
  let best: number | null = null;
  for (const w of daySchedule.schedule) {
    const start = parseHm(w.start);
    const end = parseHm(w.end);
    let inside = false;
    let minsLeft = 0;
    if (start <= end) {
      inside =
        minutesSinceMidnight >= start && minutesSinceMidnight < end;
      minsLeft = end - minutesSinceMidnight;
    } else {
      inside =
        minutesSinceMidnight >= start || minutesSinceMidnight < end;
      if (minutesSinceMidnight >= start) {
        minsLeft = 24 * 60 - minutesSinceMidnight + end;
      } else {
        minsLeft = end - minutesSinceMidnight;
      }
    }
    if (inside) {
      if (best === null || minsLeft < best) best = minsLeft;
    }
  }
  return best;
}

export function getActiveWindow(
  daySchedule: DaySchedule,
  minutesSinceMidnight: number,
): ScheduleWindow | null {
  for (const w of daySchedule.schedule) {
    const start = parseHm(w.start);
    const end = parseHm(w.end);
    if (start <= end) {
      if (minutesSinceMidnight >= start && minutesSinceMidnight < end) {
        return w;
      }
    } else if (
      minutesSinceMidnight >= start ||
      minutesSinceMidnight < end
    ) {
      return w;
    }
  }
  return null;
}

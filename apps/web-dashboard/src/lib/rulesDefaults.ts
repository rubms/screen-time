import type { RulesDocument } from "./types";
import { WEEKDAYS } from "./constants";

export function createEmptyRules(): RulesDocument {
  const weekly = Object.fromEntries(
    WEEKDAYS.map((day) => [
      day,
      {
        schedule: [{ start: "08:00", end: "21:00" }],
        dailyTotalMinutes: 120,
      },
    ]),
  ) as RulesDocument["weekly"];

  return {
    version: 0,
    weekly,
    defaults: {
      warningLeadMinutes: 5,
      gracePeriodSeconds: 120,
    },
    targets: [],
  };
}

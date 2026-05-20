import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decide } from "../dist/decide.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(root, "fixtures/cases.json");
const data = JSON.parse(readFileSync(path, "utf8"));

const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const baseWeekly = Object.fromEntries(
  days.map((d) => [
    d,
    {
      schedule: d === "sun" ? [] : [{ start: "09:00", end: "20:00" }],
      dailyTotalMinutes: d === "sun" ? null : 60,
    },
  ]),
);

let n = 0;
for (const dow of days) {
  for (const minutes of [540, 600, 1170, 1350]) {
    const activity = { app: "game.exe", platform: "windows" };
    const rules = {
      version: 1,
      defaults: { warningLeadMinutes: 5, gracePeriodSeconds: 120 },
      weekly: baseWeekly,
      targets: [],
    };
    const usage = { totalLimitedMinutes: 0, perTarget: {} };
    const nowLocal = {
      localDate: "2026-05-19",
      dayOfWeek: dow,
      minutesSinceMidnight: minutes,
      epochMs: 0,
    };
    const expected = decide(activity, rules, usage, nowLocal, []);
    data.cases.push({
      id: `generated-${dow}-${minutes}-${n++}`,
      activity,
      rules,
      usage,
      nowLocal,
      tempUnlocks: [],
      expected,
    });
  }
}

writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
console.log(`Expanded to ${data.cases.length} cases`);

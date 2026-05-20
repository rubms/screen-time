import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decide } from "./decide.js";
import type {
  Activity,
  Decision,
  NowLocal,
  Rules,
  TempUnlock,
  UsageToday,
} from "./types.js";

interface FixtureCase {
  id: string;
  activity: Activity;
  rules: Rules;
  usage: UsageToday;
  nowLocal: NowLocal;
  tempUnlocks: TempUnlock[];
  expected: Decision;
}

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../fixtures/cases.json",
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
  cases: FixtureCase[];
};

describe("fixture parity", () => {
  for (const c of fixture.cases) {
    it(c.id, () => {
      const actual = decide(
        c.activity,
        c.rules,
        c.usage,
        c.nowLocal,
        c.tempUnlocks,
      );
      expect(actual).toEqual(c.expected);
    });
  }
});

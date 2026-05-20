import { describe, expect, it } from "vitest";

const VALID_SCOPES = new Set(["schedule", "schedule+quotas", "add-minutes"]);
const MAX = 240;
const MIN = 1;

function validateUnlock(data: {
  scope: string;
  target?: string;
  additionalMinutes?: number;
  durationMinutes?: number;
}): string | null {
  if (!VALID_SCOPES.has(data.scope)) {
    return `invalid scope: ${data.scope}`;
  }
  if (data.scope === "add-minutes") {
    if (!data.target) return "add-minutes requires target";
    const mins = data.additionalMinutes;
    if (mins == null || mins < MIN || mins > MAX) {
      return `additionalMinutes must be ${MIN}-${MAX}`;
    }
    return null;
  }
  const duration = data.durationMinutes;
  if (duration == null || duration < MIN || duration > MAX) {
    return `durationMinutes must be ${MIN}-${MAX}`;
  }
  return null;
}

describe("validateTempUnlock bounds", () => {
  it("rejects unknown scope", () => {
    expect(validateUnlock({ scope: "all-access", durationMinutes: 30 })).toContain(
      "invalid scope",
    );
  });

  it("rejects duration over 240", () => {
    expect(validateUnlock({ scope: "schedule", durationMinutes: 9999 })).toContain(
      "durationMinutes",
    );
  });

  it("requires target for add-minutes", () => {
    expect(
      validateUnlock({ scope: "add-minutes", additionalMinutes: 30 }),
    ).toContain("target");
  });

  it("accepts valid schedule unlock", () => {
    expect(validateUnlock({ scope: "schedule", durationMinutes: 15 })).toBeNull();
  });
});

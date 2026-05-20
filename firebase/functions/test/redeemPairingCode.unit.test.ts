import { describe, expect, it } from "vitest";
import { invalidArgument, pairingConflict, pairingExpired } from "../src/lib/errors";

describe("redeemPairingCode errors", () => {
  it("maps expired codes to failed-precondition with http 410", () => {
    const err = pairingExpired();
    expect(err.code).toBe("failed-precondition");
    expect(err.details).toEqual({ httpStatus: 410 });
  });

  it("maps redeemed codes to already-exists with http 409", () => {
    const err = pairingConflict();
    expect(err.code).toBe("already-exists");
    expect(err.details).toEqual({ httpStatus: 409 });
  });

  it("validates required fields", () => {
    const err = invalidArgument("missing");
    expect(err.code).toBe("invalid-argument");
  });
});

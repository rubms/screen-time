import { describe, expect, it } from "vitest";
import { testUrlAgainstPattern, validateUrlPattern } from "./urlPattern";

describe("validateUrlPattern", () => {
  it("rejects invalid patterns", () => {
    expect(validateUrlPattern("not a url pattern!!!").valid).toBe(false);
    expect(validateUrlPattern("https://evil.com").valid).toBe(false);
  });

  it("accepts host patterns", () => {
    expect(validateUrlPattern("youtube.com").valid).toBe(true);
  });
});

describe("testUrlAgainstPattern", () => {
  it("matches hostnames", () => {
    expect(testUrlAgainstPattern("youtube.com", "https://www.youtube.com/watch")).toBe(
      true,
    );
  });
});

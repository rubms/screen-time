import { describe, expect, it } from "vitest";
import { matchUrlPattern, normalizeUrl, patternSpecificity } from "./url.js";

describe("url", () => {
  it("normalizes scheme and query", () => {
    expect(normalizeUrl("https://Example.com/path?q=1")).toBe("example.com/path");
  });

  it("wildcard subdomain", () => {
    expect(matchUrlPattern("en.wikipedia.org/wiki", "*.wikipedia.org")).toBe(true);
  });

  it("path prefix", () => {
    expect(matchUrlPattern("youtube.com/shorts/abc", "youtube.com/shorts/")).toBe(
      true,
    );
  });

  it("specificity orders longer first", () => {
    expect(
      patternSpecificity("youtube.com/kids/") > patternSpecificity("youtube.com"),
    ).toBe(true);
  });

  it("strips hash from normalized url", () => {
    expect(normalizeUrl("http://a.com/x#frag")).toBe("a.com/x");
  });

  it("host-only pattern matches subdomains", () => {
    expect(matchUrlPattern("kids.youtube.com/watch", "youtube.com")).toBe(true);
  });

  it("exact host wildcard root", () => {
    expect(matchUrlPattern("wikipedia.org", "*.wikipedia.org")).toBe(true);
  });
});

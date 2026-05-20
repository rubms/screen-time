/** Strip scheme and query; keep host + path. */
export function normalizeUrl(raw: string): string {
  let u = raw.trim().toLowerCase();
  u = u.replace(/^https?:\/\//, "");
  const q = u.indexOf("?");
  if (q >= 0) u = u.slice(0, q);
  const hash = u.indexOf("#");
  if (hash >= 0) u = u.slice(0, hash);
  return u.replace(/\/+$/, "") || u;
}

/** Longest matching pattern wins. */
export function matchUrlPattern(
  normalizedUrl: string,
  pattern: string,
): boolean {
  const p = pattern.toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");

  if (p.startsWith("*.")) {
    const suffix = p.slice(1);
    const host = normalizedUrl.split("/")[0] ?? "";
    return host === suffix.slice(1) || host.endsWith(suffix);
  }

  if (p.includes("/")) {
    return normalizedUrl === p || normalizedUrl.startsWith(p);
  }

  const host = normalizedUrl.split("/")[0] ?? "";
  return host === p || host.endsWith("." + p);
}

export function patternSpecificity(pattern: string): number {
  return pattern.length;
}

export interface UrlPatternValidation {
  valid: boolean;
  error?: string;
}

const INVALID_CHARS = /[\s<>{}|\\^`]/;

export function validateUrlPattern(pattern: string): UrlPatternValidation {
  const trimmed = pattern.trim();
  if (!trimmed) {
    return { valid: false, error: "Pattern is required" };
  }
  if (INVALID_CHARS.test(trimmed)) {
    return { valid: false, error: "Contains invalid characters" };
  }
  if (trimmed.includes("://")) {
    return { valid: false, error: "Do not include http:// or https://" };
  }
  if (/^https?:/i.test(trimmed)) {
    return { valid: false, error: "Do not include a scheme" };
  }
  return { valid: true };
}

function hostnameFromUrl(url: string): string | null {
  try {
    const withScheme = url.includes("://") ? url : `https://${url}`;
    return new URL(withScheme).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function patternMatchesHost(pattern: string, host: string): boolean {
  const p = pattern.toLowerCase().replace(/^\*\./, "");
  if (pattern.startsWith("*.")) {
    return host === p.slice(1) || host.endsWith(`.${p.replace(/^\./, "")}`);
  }
  const slash = pattern.indexOf("/");
  const hostPart = slash >= 0 ? pattern.slice(0, slash).toLowerCase() : pattern.toLowerCase();
  if (host !== hostPart && !host.endsWith(`.${hostPart}`)) {
    return false;
  }
  if (slash < 0) return true;
  const pathPattern = pattern.slice(slash);
  const path = new URL(`https://${host}/`).pathname;
  const glob = pathPattern.replace(/\*/g, ".*");
  return new RegExp(`^${glob}`).test(path);
}

export function testUrlAgainstPattern(pattern: string, testUrl: string): boolean {
  const host = hostnameFromUrl(testUrl);
  if (!host) return false;
  return patternMatchesHost(pattern.trim(), host);
}

from __future__ import annotations


def normalize_url(raw: str) -> str:
    u = raw.strip().lower()
    if u.startswith("https://"):
        u = u[8:]
    elif u.startswith("http://"):
        u = u[7:]
    q = u.find("?")
    if q >= 0:
        u = u[:q]
    h = u.find("#")
    if h >= 0:
        u = u[:h]
    return u.rstrip("/") or u


def match_url_pattern(normalized_url: str, pattern: str) -> bool:
    p = pattern.lower().replace("https://", "").replace("http://", "").rstrip("/")

    if p.startswith("*."):
        suffix = p[1:]
        host = normalized_url.split("/")[0]
        return host == suffix[1:] or host.endswith(suffix)

    if "/" in p:
        return normalized_url == p or normalized_url.startswith(p)

    host = normalized_url.split("/")[0]
    return host == p or host.endswith("." + p)


def pattern_specificity(pattern: str) -> int:
    return len(pattern)

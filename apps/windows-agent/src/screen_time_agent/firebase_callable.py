"""HTTP client for Firebase HTTPS callable functions (Gen2)."""

from __future__ import annotations

from typing import Any

import requests


def call_function(url: str, data: dict[str, Any], *, timeout: int = 30) -> dict[str, Any]:
    """POST to a callable URL; returns the unwrapped ``result`` object."""
    resp = requests.post(url, json={"data": data}, timeout=timeout)
    body: Any = {}
    if resp.content:
        try:
            body = resp.json()
        except ValueError:
            body = {"raw": resp.text}

    def _error_message(err: object) -> str:
        if isinstance(err, dict):
            return str(err.get("message") or err.get("status") or err)
        return str(err)

    if resp.status_code >= 400:
        err = body.get("error", body) if isinstance(body, dict) else body
        raise RuntimeError(f"callable failed ({resp.status_code}): {_error_message(err)}")

    if not isinstance(body, dict):
        raise RuntimeError(f"unexpected callable response: {body!r}")

    if "error" in body:
        raise RuntimeError(f"callable error: {_error_message(body['error'])}")

    result = body.get("result", body)
    if not isinstance(result, dict):
        raise RuntimeError(f"unexpected callable result: {result!r}")
    return result

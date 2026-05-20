"""Integration-style test for agent core loop (mock watcher on non-Windows)."""

from __future__ import annotations

import json
import sys
import threading
import time
from pathlib import Path

import pytest

from screen_time_agent.agent_core import AgentCore
from screen_time_agent.paths import ensure_data_dirs, rules_cache_path


@pytest.fixture
def agent_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setenv("PROGRAMDATA", str(tmp_path))
    ensure_data_dirs()
    rules = {
        "version": 1,
        "defaults": {"warningLeadMinutes": 5, "gracePeriodSeconds": 120},
        "weekly": {
            d: {"schedule": [{"start": "00:00", "end": "23:59"}], "dailyTotalMinutes": 180}
            for d in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
        },
        "targets": [
            {
                "kind": "app",
                "id": "chrome",
                "displayName": "Chrome",
                "platform": "windows",
                "matchers": [{"platform": "windows", "matcher": "chrome.exe"}],
                "category": "LIMITED",
                "dailyQuotaMinutes": {"default": 120},
            },
        ],
    }
    rules_cache_path().write_text(json.dumps(rules), encoding="utf-8")
    return tmp_path


def test_agent_core_emits_focus_events(agent_env: Path) -> None:
    emitted: list[dict] = []

    core = AgentCore()
    original_emit = core._firestore.emit

    def capture(payload: dict) -> None:
        emitted.append(payload)
        try:
            original_emit(payload)
        except Exception:
            pass

    core._firestore.emit = capture  # type: ignore[method-assign]

    core.start()
    time.sleep(4)
    core.stop()

    types = {e.get("type") or e.get("eventType") for e in emitted}
    assert "agent-start" in types
    if sys.platform != "win32":
        assert any(t in types for t in ("focus-start", "focus-end"))

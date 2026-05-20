"""LocalStateStore tests."""

from __future__ import annotations

from pathlib import Path

import pytest

from screen_time_agent.local_state_store import LocalStateStore


def test_enqueue_and_pending(tmp_path: Path) -> None:
    db = tmp_path / "state.sqlite"
    store = LocalStateStore(db)
    eid = store.enqueue_event({"type": "focus-start", "app": "chrome.exe"})
    assert eid == 1
    pending = store.pending_events()
    assert len(pending) == 1
    assert pending[0][1]["app"] == "chrome.exe"
    store.mark_events_synced([eid])
    assert store.pending_events() == []


def test_usage_accumulation(tmp_path: Path) -> None:
    store = LocalStateStore(tmp_path / "s.sqlite")
    store.add_usage_minutes("youtube.com", 5.0)
    store.add_usage_minutes("youtube.com", 2.5)
    usage = store.get_usage_today()
    assert usage["youtube.com"] == pytest.approx(7.5)

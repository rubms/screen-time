"""Mock foreground watcher smoke test."""

from __future__ import annotations

import queue
import time

from screen_time_agent.mock_foreground_watcher import MockForegroundWatcher


def test_mock_emits_focus_events() -> None:
    q: queue.Queue = queue.Queue()
    watcher = MockForegroundWatcher(q)
    watcher.start()
    time.sleep(3.5)
    watcher.stop()
    assert not q.empty()
    evt = q.get_nowait()
    assert evt.current_app.endswith(".exe")

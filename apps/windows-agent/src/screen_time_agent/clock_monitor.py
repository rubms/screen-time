"""Detect suspicious wall-clock drift vs monotonic time."""

from __future__ import annotations

import logging
import threading
import time
from datetime import datetime, timezone
from typing import Callable

logger = logging.getLogger(__name__)

DRIFT_THRESHOLD_SEC = 120.0
CHECK_INTERVAL_SEC = 30.0


class ClockMonitor:
    def __init__(self, on_tamper: Callable[[], None] | None = None) -> None:
        self._on_tamper = on_tamper
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._mono_anchor = time.monotonic()
        self._wall_anchor = datetime.now(timezone.utc)

    def start(self) -> None:
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name="ClockMonitor", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=3)

    def monotonic_elapsed_sec(self) -> float:
        return time.monotonic() - self._mono_anchor

    def _run(self) -> None:
        while not self._stop.wait(CHECK_INTERVAL_SEC):
            mono_elapsed = time.monotonic() - self._mono_anchor
            wall_elapsed = (datetime.now(timezone.utc) - self._wall_anchor).total_seconds()
            drift = abs(wall_elapsed - mono_elapsed)
            if drift > DRIFT_THRESHOLD_SEC:
                logger.warning("clock-tamper-suspected drift=%.1fs", drift)
                if self._on_tamper:
                    self._on_tamper()

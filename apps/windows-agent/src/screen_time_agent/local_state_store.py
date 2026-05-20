"""SQLite local state — events queue, usage, rules/unlocks cache."""

from __future__ import annotations

import json
import sqlite3
import threading
from contextlib import contextmanager
from datetime import date, datetime
from pathlib import Path
from typing import Any, Iterator

from screen_time_agent.paths import ensure_data_dirs, state_db_path
from screen_time_rules.models import Rules, TempUnlock


class LocalStateStore:
    def __init__(self, db_path: Path | None = None) -> None:
        self._path = db_path or state_db_path()
        self._lock = threading.RLock()
        ensure_data_dirs()
        self._init_db()

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    payload TEXT NOT NULL,
                    synced INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS usage_today (
                    local_date TEXT NOT NULL,
                    target_id TEXT NOT NULL,
                    minutes REAL NOT NULL DEFAULT 0,
                    PRIMARY KEY (local_date, target_id)
                );
                CREATE TABLE IF NOT EXISTS rules_cache_meta (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    version INTEGER,
                    updated_at TEXT
                );
                CREATE TABLE IF NOT EXISTS unlocks_cache (
                    unlock_id TEXT PRIMARY KEY,
                    payload TEXT NOT NULL
                );
                """
            )

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self._path, timeout=30, isolation_level=None)
        try:
            yield conn
        finally:
            conn.close()

    def enqueue_event(self, payload: dict[str, Any]) -> int:
        with self._lock, self._connect() as conn:
            cur = conn.execute(
                "INSERT INTO events (payload, synced, created_at) VALUES (?, 0, ?)",
                (json.dumps(payload), datetime.utcnow().isoformat()),
            )
            return int(cur.lastrowid)

    def pending_events(self, limit: int = 100) -> list[tuple[int, dict[str, Any]]]:
        with self._lock, self._connect() as conn:
            rows = conn.execute(
                "SELECT id, payload FROM events WHERE synced = 0 ORDER BY id LIMIT ?",
                (limit,),
            ).fetchall()
        return [(int(r[0]), json.loads(r[1])) for r in rows]

    def mark_events_synced(self, ids: list[int]) -> None:
        if not ids:
            return
        placeholders = ",".join("?" * len(ids))
        with self._lock, self._connect() as conn:
            conn.execute(
                f"UPDATE events SET synced = 1 WHERE id IN ({placeholders})",
                ids,
            )

    def purge_old_synced_events(self, days: int = 7) -> int:
        cutoff = datetime.utcnow().isoformat()
        with self._lock, self._connect() as conn:
            cur = conn.execute(
                "DELETE FROM events WHERE synced = 1 AND created_at < datetime(?, '-' || ? || ' days')",
                (cutoff, days),
            )
            return cur.rowcount

    def get_usage_today(self, local_date: date | None = None) -> dict[str, float]:
        d = (local_date or date.today()).isoformat()
        with self._lock, self._connect() as conn:
            rows = conn.execute(
                "SELECT target_id, minutes FROM usage_today WHERE local_date = ?",
                (d,),
            ).fetchall()
        return {str(r[0]): float(r[1]) for r in rows}

    def add_usage_minutes(self, target_id: str, minutes: float, local_date: date | None = None) -> None:
        d = (local_date or date.today()).isoformat()
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO usage_today (local_date, target_id, minutes)
                VALUES (?, ?, ?)
                ON CONFLICT(local_date, target_id) DO UPDATE SET
                    minutes = minutes + excluded.minutes
                """,
                (d, target_id, minutes),
            )

    def set_rules_meta(self, version: int) -> None:
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO rules_cache_meta (id, version, updated_at) VALUES (1, ?, ?)
                ON CONFLICT(id) DO UPDATE SET version = excluded.version,
                    updated_at = excluded.updated_at
                """,
                (version, datetime.utcnow().isoformat()),
            )

    def save_unlocks(self, unlocks: list[TempUnlock]) -> None:
        with self._lock, self._connect() as conn:
            conn.execute("DELETE FROM unlocks_cache")
            for u in unlocks:
                conn.execute(
                    "INSERT INTO unlocks_cache (unlock_id, payload) VALUES (?, ?)",
                    (u.device_id + ":" + str(hash(u.model_dump_json())), u.model_dump_json()),
                )

    def load_unlocks(self) -> list[TempUnlock]:
        with self._lock, self._connect() as conn:
            rows = conn.execute("SELECT payload FROM unlocks_cache").fetchall()
        result: list[TempUnlock] = []
        for (payload,) in rows:
            result.append(TempUnlock.model_validate_json(payload))
        return result

    @staticmethod
    def rules_from_json(text: str) -> Rules:
        return Rules.model_validate_json(text)

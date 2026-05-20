"""Firestore sync — listeners and batched event upload."""

from __future__ import annotations

import json
import logging
import queue
import threading
import time
from datetime import datetime, timezone
from typing import Any, Callable

from screen_time_agent.config import DeviceConfig, load_config, load_custom_token
from screen_time_agent.local_state_store import LocalStateStore
from screen_time_agent.paths import rules_cache_path
from screen_time_rules.models import Rules, TempUnlock

logger = logging.getLogger(__name__)


class FirestoreClient:
    """Manages Firestore listeners and event queue flushing."""

    def __init__(
        self,
        store: LocalStateStore,
        on_rules: Callable[[Rules], None] | None = None,
        on_unlocks: Callable[[list[TempUnlock]], None] | None = None,
    ) -> None:
        self._store = store
        self._on_rules = on_rules
        self._on_unlocks = on_unlocks
        self._event_queue: queue.Queue[dict[str, Any]] = queue.Queue()
        self._stop = threading.Event()
        self._upload_thread: threading.Thread | None = None
        self._db: Any = None
        self._cfg: DeviceConfig | None = None

    def start(self) -> None:
        self._cfg = load_config()
        if self._cfg is None:
            logger.warning("not paired — Firestore sync disabled")
            return
        self._init_firebase()
        self._start_listeners()
        self._stop.clear()
        self._upload_thread = threading.Thread(target=self._upload_loop, daemon=True)
        self._upload_thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._upload_thread:
            self._upload_thread.join(timeout=5)

    def emit(self, event: dict[str, Any]) -> None:
        self._store.enqueue_event(event)
        self._event_queue.put(event)

    def _init_firebase(self) -> None:
        try:
            import firebase_admin
            from firebase_admin import credentials, firestore
        except ImportError:
            logger.warning("firebase-admin not available")
            return

        token = load_custom_token()
        if not firebase_admin._apps:
            if token:
                cred = credentials.Certificate(_token_to_cred_dict(token))
                firebase_admin.initialize_app(cred)
            else:
                firebase_admin.initialize_app()
        self._db = firestore.client()

    def _start_listeners(self) -> None:
        if self._db is None or self._cfg is None:
            return
        fid, cid, did = self._cfg.family_id, self._cfg.child_id, self._cfg.device_id
        rules_ref = (
            self._db.collection("families")
            .document(fid)
            .collection("children")
            .document(cid)
            .collection("rules")
            .document("current")
        )

        def on_rules_snapshot(doc_snapshot: Any, changes: Any, read_time: Any) -> None:
            if not doc_snapshot.exists:
                return
            data = doc_snapshot.to_dict()
            rules = Rules.model_validate(data)
            rules_cache_path().write_text(rules.model_dump_json(by_alias=True, indent=2), encoding="utf-8")
            self._store.set_rules_meta(rules.version)
            if self._on_rules:
                self._on_rules(rules)

        rules_ref.on_snapshot(on_rules_snapshot)

        unlocks_query = (
            self._db.collection("families")
            .document(fid)
            .collection("temp-unlocks")
            .where("deviceId", "==", did)
            .where("revoked", "==", False)
        )

        def on_unlocks_snapshot(query_snapshot: Any, changes: Any, read_time: Any) -> None:
            unlocks = [TempUnlock.model_validate(d.to_dict()) for d in query_snapshot]
            self._store.save_unlocks(unlocks)
            if self._on_unlocks:
                self._on_unlocks(unlocks)

        unlocks_query.on_snapshot(on_unlocks_snapshot)

    def _upload_loop(self) -> None:
        backoff = 1.0
        while not self._stop.wait(30.0):
            try:
                self._flush_events()
                backoff = 1.0
            except Exception:
                logger.exception("event upload failed")
                time.sleep(backoff)
                backoff = min(backoff * 2, 300.0)

    def _flush_events(self) -> None:
        if self._db is None or self._cfg is None:
            return
        pending = self._store.pending_events()
        if not pending:
            return
        fid, did = self._cfg.family_id, self._cfg.device_id
        coll = (
            self._db.collection("families")
            .document(fid)
            .collection("devices")
            .document(did)
            .collection("events")
        )
        synced_ids: list[int] = []
        for eid, payload in pending:
            payload.setdefault("deviceId", did)
            payload.setdefault("serverAt", datetime.now(timezone.utc))
            coll.add(payload)
            synced_ids.append(eid)
        self._store.mark_events_synced(synced_ids)
        self._store.purge_old_synced_events(days=7)


def _token_to_cred_dict(token: str) -> dict[str, str]:
    """Placeholder — production uses service account or custom token exchange."""
    return json.loads(token) if token.strip().startswith("{") else {"type": "mock", "token": token}

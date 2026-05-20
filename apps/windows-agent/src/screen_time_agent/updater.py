"""Check GitHub releases via Cloud Function proxy."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import sys
import threading
import time
from pathlib import Path
from typing import Any

import requests

from screen_time_agent.paths import updates_dir

logger = logging.getLogger(__name__)

CHECK_INTERVAL_SEC = 6 * 3600


class Updater:
    def __init__(self, *, installed_version: str, update_manifest_url: str | None = None) -> None:
        self._version = installed_version
        self._url = update_manifest_url or os.environ.get(
            "SCREEN_TIME_UPDATE_MANIFEST_URL",
            "https://example.com/getUpdateManifest",
        )
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._pending: Path | None = None

    def start(self) -> None:
        self.check_now()
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=3)

    def check_now(self) -> None:
        try:
            self._check()
        except Exception:
            logger.exception("update check failed")

    def pending_binary(self) -> Path | None:
        return self._pending

    def _loop(self) -> None:
        while not self._stop.wait(CHECK_INTERVAL_SEC):
            self.check_now()

    def _check(self) -> None:
        manifest = self._fetch_manifest()
        if not manifest:
            return
        remote = manifest.get("version")
        if not remote or remote <= self._version:
            return
        asset_url = manifest.get("assetUrl")
        expected_sha = manifest.get("sha256")
        if not asset_url:
            return
        dest = updates_dir() / f"ScreenTimeControl-{remote}.exe"
        self._download(asset_url, dest, expected_sha)
        self._pending = dest
        logger.info("update %s queued at %s", remote, dest)

    def _fetch_manifest(self) -> dict[str, Any] | None:
        resp = requests.post(
            self._url,
            json={"platform": "windows", "channel": "stable"},
            timeout=30,
        )
        if resp.status_code != 200:
            return None
        return resp.json()

    def _download(self, url: str, dest: Path, expected_sha: str | None) -> None:
        dest.parent.mkdir(parents=True, exist_ok=True)
        resp = requests.get(url, timeout=120)
        resp.raise_for_status()
        data = resp.content
        if expected_sha:
            digest = hashlib.sha256(data).hexdigest()
            if digest.lower() != expected_sha.lower():
                raise ValueError(f"sha256 mismatch: {digest} != {expected_sha}")
        dest.write_bytes(data)

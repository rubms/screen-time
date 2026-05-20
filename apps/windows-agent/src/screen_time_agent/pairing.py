"""Device pairing via redeemPairingCode."""

from __future__ import annotations

import json
import logging
import os
import uuid

import requests

from screen_time_agent.config import DeviceConfig, save_config, save_custom_token

logger = logging.getLogger(__name__)


def pair_device(code: str, *, display_name: str | None = None) -> DeviceConfig:
    """Redeem pairing code and persist device credentials."""
    device_id = str(uuid.uuid4())
    url = os.environ.get(
        "SCREEN_TIME_REDEEM_URL",
        "https://example.com/redeemPairingCode",
    )
    payload = {
        "code": code.strip().upper(),
        "deviceId": device_id,
        "platform": "windows",
        "displayName": display_name or "Windows PC",
    }
    resp = requests.post(url, json=payload, timeout=30)
    if resp.status_code >= 400:
        raise RuntimeError(f"pairing failed: {resp.status_code} {resp.text}")
    data = resp.json()
    token = data.get("customToken") or data.get("custom_token")
    if token:
        save_custom_token(token if isinstance(token, str) else json.dumps(token))

    cfg = DeviceConfig(
        family_id=data["familyId"],
        child_id=data["childId"],
        device_id=device_id,
        child_display_name=data.get("childDisplayName", "Child"),
        firebase_project_id=data.get("projectId"),
        dashboard_url=data.get("dashboardUrl", os.environ.get("SCREEN_TIME_DASHBOARD_URL", "https://example.com")),
    )
    save_config(cfg)
    logger.info("paired device %s for child %s", device_id, cfg.child_id)
    return cfg

"""Device pairing via redeemPairingCode."""

from __future__ import annotations

import json
import logging
import os
import uuid

from screen_time_agent.config import DeviceConfig, save_config, save_custom_token
from screen_time_agent.firebase_callable import call_function

logger = logging.getLogger(__name__)

DEFAULT_REDEEM_URL = "https://europe-west1-screen-time-54d26.cloudfunctions.net/redeemPairingCode"


def _require_family_id(family_id: str | None) -> str:
    fid = (family_id or os.environ.get("SCREEN_TIME_FAMILY_ID") or "").strip()
    if not fid:
        raise RuntimeError(
            "familyId is required: pass --family-id or set SCREEN_TIME_FAMILY_ID "
            "(Firestore document id under families/, shown in the parent dashboard URL "
            "or Firebase console)."
        )
    return fid


def pair_device(
    code: str,
    *,
    display_name: str | None = None,
    family_id: str | None = None,
) -> DeviceConfig:
    """Redeem pairing code and persist device credentials."""
    device_id = str(uuid.uuid4())
    url = os.environ.get("SCREEN_TIME_REDEEM_URL", DEFAULT_REDEEM_URL)
    fid = _require_family_id(family_id)

    data = call_function(
        url,
        {
            "familyId": fid,
            "code": code.strip().upper(),
            "deviceId": device_id,
            "platform": "windows",
            "displayName": display_name or "Windows PC",
        },
    )

    token = data.get("customToken") or data.get("custom_token")
    if token:
        save_custom_token(token if isinstance(token, str) else json.dumps(token))

    cfg = DeviceConfig(
        family_id=data["familyId"],
        child_id=data["childId"],
        device_id=data.get("deviceId", device_id),
        child_display_name=data.get("childDisplayName", "Child"),
        firebase_project_id=data.get("projectId")
        or os.environ.get("SCREEN_TIME_FIREBASE_PROJECT_ID"),
        dashboard_url=data.get(
            "dashboardUrl",
            os.environ.get("SCREEN_TIME_DASHBOARD_URL", "https://screen-time-54d26.web.app"),
        ),
    )
    save_config(cfg)
    logger.info("paired device %s for child %s", cfg.device_id, cfg.child_id)
    return cfg

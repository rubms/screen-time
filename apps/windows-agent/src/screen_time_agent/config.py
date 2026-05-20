"""Device configuration persisted after pairing."""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel, Field

from screen_time_agent.paths import config_path, ensure_data_dirs


class DeviceConfig(BaseModel):
    family_id: str = Field(alias="familyId")
    child_id: str = Field(alias="childId")
    device_id: str = Field(alias="deviceId")
    child_display_name: str = Field("Child", alias="childDisplayName")
    firebase_project_id: str | None = Field(None, alias="firebaseProjectId")
    dashboard_url: str = Field("https://example.com", alias="dashboardUrl")
    update_channel: str = Field("stable", alias="updateChannel")
    installed_version: str = Field("0.1.0", alias="installedVersion")

    model_config = {"populate_by_name": True}


def load_config() -> DeviceConfig | None:
    path = config_path()
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    return DeviceConfig.model_validate(data)


def save_config(cfg: DeviceConfig) -> None:
    ensure_data_dirs()
    config_path().write_text(
        cfg.model_dump_json(by_alias=True, indent=2),
        encoding="utf-8",
    )


def save_custom_token(token: str) -> None:
    ensure_data_dirs()
    token_path = config_path().parent / "custom_token.txt"
    token_path.write_text(token, encoding="utf-8")


def load_custom_token() -> str | None:
    token_path = config_path().parent / "custom_token.txt"
    if not token_path.exists():
        return None
    return token_path.read_text(encoding="utf-8").strip()

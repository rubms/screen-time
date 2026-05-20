"""Filesystem paths for agent data."""

from __future__ import annotations

import os
import sys
from pathlib import Path

SERVICE_NAME = "ScreenTimeControlAgent"
APP_NAME = "ScreenTimeControl"


def program_data_dir() -> Path:
    if sys.platform == "win32":
        base = os.environ.get("PROGRAMDATA", r"C:\ProgramData")
        return Path(base) / APP_NAME
    return Path.home() / f".{APP_NAME}"


def state_db_path() -> Path:
    return program_data_dir() / "state.sqlite"


def rules_cache_path() -> Path:
    return program_data_dir() / "rules.json"


def config_path() -> Path:
    return program_data_dir() / "config.json"


def updates_dir() -> Path:
    return program_data_dir() / "updates"


def ensure_data_dirs() -> None:
    program_data_dir().mkdir(parents=True, exist_ok=True)
    updates_dir().mkdir(parents=True, exist_ok=True)

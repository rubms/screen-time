# Screen Time Control — Windows Agent

Python 3.12 agent that enforces screen-time rules on Windows child PCs. Runs as a Windows Service (`ScreenTimeControlAgent`) with a system-tray companion.

## Prerequisites

- Python 3.12
- [Poetry](https://python-poetry.org/)
- Windows 10/11 for production (service, UI Automation, toasts)
- macOS/Linux supported for **development only** via `debug-run` (mock foreground watcher)

## Install

```bash
cd apps/windows-agent
poetry install
```

You must run `poetry install` before `poetry run screen-time-agent` (installs the
`screen_time_agent` package and the `screen-time-agent` CLI script).

Successful install prints:

```text
Installing the current project: screen-time-windows-agent (0.1.0)
```

If you see `ModuleNotFoundError: No module named 'screen_time_agent'` or Poetry warns
the script is not installed, refresh the lockfile and reinstall:

```powershell
poetry lock
poetry install
```

Fallback (same CLI, no script entry point):

```powershell
$env:PYTHONPATH = "src"
poetry run python -m screen_time_agent pair --code ABC123 --family-id YOUR_FAMILY_UUID
```

## Commands

```bash
# Foreground dev mode (mock watcher on non-Windows)
poetry run screen-time-agent debug-run

# Pair device (needs family id + pairing code from parent dashboard)
poetry run screen-time-agent pair --code ABC123 --family-id YOUR_FAMILY_UUID --name "Child PC"

# Windows service (requires pywin32, admin)
poetry run screen-time-agent service install
poetry run screen-time-agent service start
poetry run screen-time-agent service stop
poetry run screen-time-agent service uninstall

# Tray UI
poetry run screen-time-agent tray
```

## Configuration

| Variable                          | Purpose                                                          |
| --------------------------------- | ---------------------------------------------------------------- |
| `SCREEN_TIME_FAMILY_ID`           | Firestore `families/{id}` document id (required for pairing)     |
| `SCREEN_TIME_REDEEM_URL`          | `redeemPairingCode` callable URL (optional; has project default) |
| `SCREEN_TIME_VERIFY_PIN_URL`      | `verifyParentPin` callable                                       |
| `SCREEN_TIME_UPDATE_MANIFEST_URL` | `getUpdateManifest` callable                                     |
| `SCREEN_TIME_DASHBOARD_URL`       | Parent dashboard URL for tray Settings                           |
| `SCREEN_TIME_FIREBASE_PROJECT_ID` | e.g. `screen-time-54d26` (optional; stored in device config)     |
| `SCREEN_TIME_DEBUG_PIN`           | Dev PIN when verify URL unset (default `0000`)                   |

Data directory:

- Windows: `%PROGRAMDATA%\ScreenTimeControl\`
- Dev (macOS/Linux): `~/.ScreenTimeControl/`

## Packages

| Package             | Role                                                    |
| ------------------- | ------------------------------------------------------- |
| `screen_time_agent` | Service, watcher, Firestore sync, UI, closer            |
| `screen_time_rules` | Pure `decide()` rules engine (parity with TS reference) |

## Tests

```bash
poetry run pytest
```

Parity tests load `packages/shared-rules-engine/fixtures/cases.json` when that file exists.

## Build

On Windows with PyInstaller installed:

```powershell
.\scripts\build-windows.ps1 -Version 0.1.0
```

Inno Setup stub: `installer/setup.iss`.

## Architecture

```
ForegroundWatcher (1 Hz) → Activity + URL
        ↓
   decide(rules, usage, unlocks)
        ↓
 WarningUI / Closer → LocalStateStore → FirestoreClient
```

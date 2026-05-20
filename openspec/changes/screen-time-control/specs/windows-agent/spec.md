## ADDED Requirements

### Requirement: Foreground window detection

The Windows agent SHALL poll the foreground window at 1 Hz using
`user32.GetForegroundWindow` and `GetWindowThreadProcessId`, resolving the
owning process's executable name via `psutil`. Polling SHALL be implemented
in a single dedicated thread.

#### Scenario: Foreground window changes

- **GIVEN** the agent is running and Chrome is in focus
- **WHEN** the user Alt-Tabs to Notepad
- **THEN** within 1 second the agent emits a `focus-changed` event with
  `previous = chrome.exe`, `current = notepad.exe`, and accurate
  `durationMs` for the previous focus

### Requirement: Browser URL extraction via UI Automation

The Windows agent SHALL, when the foreground process is a recognized
browser (Chrome, Edge, Firefox), extract the active tab URL via Windows UI
Automation by reading the address-bar edit control's value. Implementations
SHALL be per-browser and SHALL gracefully degrade to "URL unknown" on
failure (e.g., on browser update or DPI quirks).

#### Scenario: Chrome address bar read

- **GIVEN** Chrome is in focus on `https://example.com/path`
- **WHEN** the agent's UIA reader runs
- **THEN** the agent records the URL `example.com/path` (scheme + query
  stripped before passing to the rules engine)

#### Scenario: Firefox URL unreadable

- **GIVEN** Firefox is in focus but UI Automation returns no usable
  address-bar value
- **WHEN** the agent attempts to read it
- **THEN** the agent records `url = null` and the activity is evaluated
  with app-only matching
- **AND** a `url-read-failed` telemetry event is logged at most once per
  minute per browser

### Requirement: Local rules cache and offline operation

The Windows agent SHALL persist the latest rules document to
`%PROGRAMDATA%\ScreenTimeControl\rules.json` immediately upon receipt and
SHALL evaluate decisions exclusively against the local cache. The agent
SHALL function fully when offline, queuing session events to a local
SQLite database for later sync.

#### Scenario: Boot with no network

- **GIVEN** the device has no internet at startup
- **WHEN** the service starts
- **THEN** the agent loads `rules.json` from disk and begins enforcing
- **AND** session events accumulate in
  `%PROGRAMDATA%\ScreenTimeControl\events.sqlite`
- **AND** when connectivity returns, all queued events sync within 60
  seconds

### Requirement: Toast warning UI

The Windows agent SHALL display a Windows 10/11 toast notification (via
`winrt.Windows.UI.Notifications`) when the rules engine returns `WARN`,
once per `(targetId, warningThreshold)` per day to avoid spam.

#### Scenario: 5-minute warning toast

- **WHEN** the rules engine first emits a `WARN` with `remainingMinutes <=
  5` for `chrome.exe` today
- **THEN** a toast appears: "5 minutes left on Chrome"
- **AND** no further toast is shown for that target until the next day or
  until the limit is reached

### Requirement: Topmost modal dialog and forced close

The Windows agent SHALL, on `OUT_OF_TIME` or `OUTSIDE_SCHEDULE`:

1. Show a topmost, always-on-top, non-dismissable Tkinter dialog with a
   countdown of `gracePeriodSeconds`.
2. When the countdown reaches 0, attempt to close the offending tab via UI
   Automation (Ctrl+W equivalent on the browser); if not possible, close
   the entire browser/app via `TerminateProcess` after first sending
   `WM_CLOSE`.
3. Re-open or re-focus attempts within the next 60 seconds SHALL be
   immediately re-closed (no grace) until a new schedule window opens or
   quota is restored.

#### Scenario: Force-close a browser tab

- **GIVEN** the child has 0 minutes left on YouTube and the grace countdown
  ended
- **WHEN** the agent closes the activity
- **THEN** the YouTube tab is closed (Ctrl+W sent via UIA), other Chrome
  tabs remain open

#### Scenario: Immediate re-block on relaunch

- **GIVEN** Chrome was force-closed because the global schedule ended
- **WHEN** the child re-launches Chrome within 60 seconds
- **THEN** the agent closes Chrome immediately with NO grace period and a
  brief "Outside allowed hours" toast

### Requirement: Windows Service installation and watchdog

The Windows agent SHALL be installed as a Windows Service running as
`LocalSystem`, configured with `recovery actions = restart after 5s` for
the first three failures. A separate lightweight watchdog (scheduled task
running at user login) SHALL verify the service is `RUNNING` and start it
if not.

#### Scenario: Service killed via Task Manager

- **GIVEN** the agent service is running with admin protections enabled
- **WHEN** an attempt is made to End Task the service from Task Manager as
  a standard user
- **THEN** access is denied (LocalSystem protection)

#### Scenario: Service crashes

- **WHEN** the service process exits unexpectedly
- **THEN** Windows SCM restarts it within 5 seconds
- **AND** a `service-restart` tamper-event is logged

### Requirement: Tray UI for the child / parent

The Windows agent SHALL provide a system-tray icon (via `pystray`)
showing today's remaining time, current category, and a PIN-protected
"Settings" entry that opens the parent dashboard URL.

#### Scenario: Hover shows remaining time

- **WHEN** the parent hovers the tray icon
- **THEN** the tooltip shows "Alex — 1h 23m left today (LIMITED)"

#### Scenario: Settings requires PIN

- **WHEN** the user clicks "Settings…" in the tray menu
- **THEN** a PIN prompt appears
- **AND** only the family's `parentPin` (configured in dashboard) unlocks
  the dashboard URL

### Requirement: Telemetry and Firestore sync

The Windows agent SHALL emit `session-event` documents to
`families/{familyId}/devices/{deviceId}/events/{eventId}` for: focus-start,
focus-end (with duration), warning-shown, force-close, tamper-attempt,
sync-error, agent-start, agent-stop. Events older than 7 days SHALL be
purged client-side after successful sync confirmation.

#### Scenario: Focus session produces start and end events

- **WHEN** Chrome is focused for 4 minutes then user switches away
- **THEN** two events are written: `focus-start` (with `app`, `url`,
  `targetId`, `category`, `startedAt`) and `focus-end` (with
  `endedAt`, `durationMs = 240000`)

### Requirement: Auto-update integration

The Windows agent SHALL check for updates against the configured GitHub
Releases feed every 6 hours and on service start. New releases SHALL be
downloaded to a staging folder, verified against the release's SHA-256
checksum from the Cloud Function update proxy, and installed on the next
service restart.

#### Scenario: New version available

- **GIVEN** installed version 1.2.0 and a published release 1.3.0
- **WHEN** the periodic update check runs
- **THEN** 1.3.0 is downloaded, verified, and queued for install
- **AND** the next scheduled service restart (or immediate one if
  `autoRestart = true`) replaces the binary and starts running 1.3.0

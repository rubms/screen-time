## ADDED Requirements

### Requirement: Tamper-event taxonomy

The system SHALL classify tamper attempts into the following types,
emitted as `tamper-attempt` events with a `tamperKind`:

- `service-stop-attempt` (Windows): user attempted to stop the service.
- `service-restart` (Windows): service crashed or was killed and was
  auto-restarted.
- `accessibility-disabled` (Android): the AccessibilityService was
  disabled.
- `device-admin-deactivation-attempt` (Android): user opened the Device
  Admin deactivation flow.
- `force-stop-detected` (Android): foreground service was killed and
  WorkManager respawned it.
- `clock-tamper-suspected`: device's local clock jumped backward by >5
  minutes or forward by >2 hours unexpectedly.
- `uninstall-attempted` (Android): uninstall flow was launched.

#### Scenario: Clock rollback detected

- **GIVEN** the agent's monotonic clock and wall clock have drifted by
  +1 hour and the wall clock jumps back -2 hours
- **WHEN** the agent's clock-monitor next ticks
- **THEN** a `tamper-attempt` event with `tamperKind =
  "clock-tamper-suspected"` is emitted
- **AND** the agent ignores the wall-clock decrease for quota counting
  (uses monotonic delta) until the wall clock catches up

### Requirement: Windows hardening

The Windows agent SHALL:

- Run as a `LocalSystem` Windows Service.
- Set DACLs on its install directory and `%PROGRAMDATA%\ScreenTimeControl`
  to deny non-admin write access.
- Register service recovery actions: restart after 5s for the first 3
  failures, reset failure count daily.
- Install a watchdog scheduled task (`onLogon`, `onScheduleHourly`) that
  re-starts the service if not running.
- Use a parent PIN (hashed in Firestore, verified locally via a periodic
  fetch) to gate ALL local config UI access.

#### Scenario: Standard user cannot stop service

- **GIVEN** a standard (non-admin) Windows user
- **WHEN** they run `net stop ScreenTimeControl` or open Services.msc
- **THEN** they receive "Access is denied" and the service continues
  running

### Requirement: Android hardening

The Android agent SHALL:

- Register a `DeviceAdminReceiver` with the `lockNow` and
  `disableUninstall` policies (where supported by API level).
- Persist a tamper-detected `LockoutActivity` that takes over the screen
  if AccessibilityService is disabled, until re-enabled.
- Use the parent PIN to gate ALL on-device settings access.
- Listen for `PACKAGE_REMOVED` for its own package and (best-effort)
  attempt re-pair / Firestore alert before being killed.

#### Scenario: Accessibility re-disable detected

- **GIVEN** the agent is running normally
- **WHEN** the user toggles Accessibility off in Settings
- **THEN** within 5 seconds the agent (via `AccessibilityManager
  .addAccessibilityStateChangeListener`) detects the change, emits a
  `tamper-attempt`, and launches `LockoutActivity` with the message
  "Re-enable Accessibility to use this device."
- **AND** all LIMITED and BLOCKED apps are inaccessible (lock overlay)
  until Accessibility is re-enabled

### Requirement: Parent PIN

The system SHALL define a single parent PIN per family (4–8 digits)
stored as a bcrypt hash in `families/{familyId}/private/secrets`. Both
agents SHALL fetch the hash on start and on every rules update and use
it to gate local config access (Windows tray Settings, Android setup
Activity, post-install permission changes).

#### Scenario: PIN protects tray settings

- **WHEN** an unauthenticated user clicks "Settings…" in the Windows
  tray
- **THEN** a PIN entry dialog appears
- **AND** entering a wrong PIN 3 times disables the dialog for 5 minutes
  and emits a `tamper-attempt` event with `tamperKind =
  "pin-bruteforce-attempt"`

### Requirement: Tamper alerts in dashboard

The dashboard SHALL show a prominent banner on the family home page when
any tamper-attempt event has occurred in the last 24 hours, with a
direct link to the per-event detail (device, time, kind, surrounding
events).

#### Scenario: Tamper banner

- **GIVEN** 1+ tamper-attempt events in the last 24h
- **WHEN** the parent loads the dashboard
- **THEN** a red banner "Tamper attempt detected on Alex's phone — 2h
  ago" is displayed
- **AND** clicking it deep-links to the event detail

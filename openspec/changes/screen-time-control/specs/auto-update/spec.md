## ADDED Requirements

### Requirement: Update manifest source

The system SHALL publish releases to a single GitHub repository
configured at build time (`UPDATE_REPO = "owner/screen-time-control"`).
A Cloud Function `getUpdateManifest({ platform, channel })` SHALL proxy
GitHub's Releases API to return the latest applicable release with the
asset URL and SHA-256 checksum (published in the release body in a
predictable `sha256: <hex>` line).

#### Scenario: Manifest fetched

- **WHEN** an agent requests `getUpdateManifest({ platform:
  "windows", channel: "stable" })`
- **THEN** the function returns `{ version: "1.3.0", url:
  "https://github.com/.../ScreenTimeControl-1.3.0.exe", sha256:
  "abc..." }`

### Requirement: Update channel selection

Each device document SHALL have an `updateChannel` field (default
`"stable"`; `"beta"` is also supported). Channels SHALL be configurable
per device from the dashboard.

#### Scenario: Beta opt-in

- **GIVEN** a device on `stable` at v1.2.0
- **WHEN** the parent switches it to `beta` and a v1.3.0-beta.1 release
  exists with prerelease=true and channel-eligible
- **THEN** the device's next update check picks up v1.3.0-beta.1

### Requirement: Verification

Agents SHALL refuse to install an update whose downloaded SHA-256 does
not match the manifest. The mismatch SHALL be logged as a `sync-error`
event with kind `"update-checksum-mismatch"`.

#### Scenario: Tampered download rejected

- **GIVEN** a download whose computed SHA-256 differs from the manifest
- **WHEN** verification runs
- **THEN** the file is deleted, an event is logged, the update is
  postponed by 1 hour

### Requirement: Windows install behavior

The Windows agent SHALL download to
`%PROGRAMDATA%\ScreenTimeControl\updates\` and apply the update on next
service restart by swapping the executable. If the parent has enabled
`autoRestart`, the service SHALL restart immediately after a successful
verification.

#### Scenario: Apply on next restart

- **GIVEN** v1.3.0 is downloaded + verified and `autoRestart = false`
- **WHEN** the next scheduled service restart occurs (or the watchdog
  restarts the service)
- **THEN** the new binary is in place and runs v1.3.0

### Requirement: Android install behavior

The Android agent SHALL download the APK to internal storage and present
a high-priority notification that opens the Android package installer
when tapped. Fully-silent installation SHALL NOT be performed (would
require Device Owner privileges, out of scope).

#### Scenario: User installs the APK

- **WHEN** the user taps the "Update available" notification
- **THEN** Android's package installer opens for the new APK
- **AND** after install, the agent service is restarted by Android and
  the update event is logged

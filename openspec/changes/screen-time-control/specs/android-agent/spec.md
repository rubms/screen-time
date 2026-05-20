## ADDED Requirements

### Requirement: Foreground app detection via AccessibilityService

The Android agent SHALL run an `AccessibilityService` declared with
`android:accessibilityEventTypes="typeWindowStateChanged|
typeWindowContentChanged"` to detect foreground app package changes in
real time (latency ≤ 500 ms).

#### Scenario: User switches apps

- **GIVEN** the Accessibility service is enabled and YouTube is foreground
- **WHEN** the user opens Settings
- **THEN** within 500 ms the agent emits a `focus-changed` event with
  `previous = com.google.android.youtube`, `current =
  com.android.settings`

### Requirement: Browser URL extraction via Accessibility events

The Android agent SHALL, when the foreground package matches a known
browser (Chrome, Edge, Firefox), traverse `AccessibilityNodeInfo` to read
the address-bar (resource IDs `com.android.chrome:id/url_bar`,
`com.microsoft.emmx:id/url_bar`, `org.mozilla.firefox:id/url_bar_title`,
etc.). On node-id changes (browser updates) the agent SHALL fall back to a
URL-text-pattern heuristic and log `url-read-failed`.

#### Scenario: Chrome URL bar read

- **GIVEN** Chrome shows `https://example.com/path`
- **WHEN** the agent inspects the foreground window's node tree
- **THEN** the URL `example.com/path` is reported to the rules engine

#### Scenario: Browser update breaks resource id

- **GIVEN** a new Chrome version renames `url_bar`
- **WHEN** the agent inspects the node tree
- **THEN** the agent records `url = null` (rules engine falls back to app
  category) AND emits at most one `url-read-failed` event per minute

### Requirement: Foreground service for continuous tracking

The Android agent SHALL run a `FOREGROUND_SERVICE_SPECIAL_USE` service
with a persistent low-priority notification, ensuring the OS does not kill
it. The notification text SHALL display today's remaining time and current
category.

#### Scenario: Foreground notification visible

- **WHEN** the agent service starts after boot
- **THEN** a persistent notification "Screen Time: 1h 12m left" is shown
  in the system tray, channel `SCREEN_TIME_STATUS`, importance LOW

### Requirement: Boot-time auto-start

The Android agent SHALL register a `BOOT_COMPLETED` broadcast receiver and
start the foreground service automatically when the device boots. If the
AccessibilityService is disabled at boot, the agent SHALL show a
high-priority notification asking the parent to re-enable it.

#### Scenario: Device reboot

- **GIVEN** the agent was running before reboot
- **WHEN** the device boots and unlocks
- **THEN** the agent foreground service is restarted within 10 seconds
- **AND** the accessibility status is verified

### Requirement: Warning and lock-out UI

The Android agent SHALL show:

- A toast (`Toast.LENGTH_SHORT`) when the engine returns the first `WARN`
  for a target today (matching `warningLeadMinutes` threshold).
- A topmost dialog activity (`TYPE_APPLICATION_OVERLAY` permission +
  full-screen Activity) with a countdown when the engine returns
  `OUT_OF_TIME` or `OUTSIDE_SCHEDULE`.
- On grace-period expiry: launch the Home intent (`ACTION_MAIN` +
  `CATEGORY_HOME`) to forcibly send the user to the launcher, then show a
  full-screen `LockoutActivity` overlay until the user navigates away.

#### Scenario: Warning toast

- **WHEN** the rules engine first reports `WARN` for YouTube today
- **THEN** a toast "5 min left on YouTube" appears for ~3 seconds

#### Scenario: Lockout after grace

- **WHEN** the grace countdown ends while YouTube is foreground
- **THEN** the agent calls `startActivity(Intent.ACTION_MAIN /
  CATEGORY_HOME)` and shows `LockoutActivity` covering the screen
- **AND** any subsequent attempt to reopen YouTube within 60 seconds is
  immediately re-locked with no grace

### Requirement: Tamper resistance via Device Admin

The Android agent SHALL register a `DeviceAdminReceiver` requesting
`uninstallBlocked` and `disableKeyguardFeatures = 0` policies, requiring
the parent PIN to be cleared via the Settings UI.

#### Scenario: Uninstall blocked

- **GIVEN** Device Admin is active for the agent
- **WHEN** a user attempts to uninstall the app from Settings → Apps
- **THEN** the Uninstall button is greyed out
- **AND** the child must first deactivate Device Admin, which requires
  the parent PIN

#### Scenario: Accessibility disabled in Settings

- **GIVEN** the agent is running with Accessibility enabled
- **WHEN** the user disables Accessibility for the agent from system
  Settings
- **THEN** the foreground service detects this within 5 seconds (via
  `AccessibilityManager` listener)
- **AND** emits a `tamper-attempt` event
- **AND** triggers `LockoutActivity` with the message "Re-enable
  Accessibility to unlock" until Accessibility is restored

### Requirement: Local rules cache and offline operation

The Android agent SHALL persist the latest rules document to internal
storage (`Context.filesDir/rules.json`) and SHALL operate fully when
offline using a Room-backed event queue, syncing to Firestore when
WorkManager-scheduled network jobs run.

#### Scenario: Sync after airplane mode

- **WHEN** the device exits airplane mode after 2 hours of offline use
- **THEN** WorkManager's `SyncWorker` runs within 1 minute and uploads all
  queued events to `families/{familyId}/devices/{deviceId}/events/`

### Requirement: Pairing UI

The Android agent SHALL provide a single setup Activity that:

1. Prompts the parent to grant: Accessibility, Display-over-other-apps,
   Battery-optimization-exemption, Device Admin, and Foreground service
   permission (Android 14+).
2. Asks the parent for the pairing code from the dashboard.
3. Calls the `redeemPairingCode` Cloud Function and stores the returned
   custom token in EncryptedSharedPreferences.

#### Scenario: Successful pairing

- **WHEN** all permissions are granted and a valid 6-character code is
  entered
- **THEN** the agent exchanges the code for a custom token, signs into
  Firebase Auth, and transitions to the running foreground-service state
- **AND** the dashboard's device list shows the new device within 10
  seconds

### Requirement: Auto-update integration

The Android agent SHALL check GitHub Releases every 6 hours and on boot.
When a newer APK is available, it SHALL download the APK to internal
storage, verify its SHA-256 against the proxy, and prompt the user to
install (Android prevents fully silent APK installs without owner privs).

#### Scenario: Update prompt

- **GIVEN** installed version 1.2.0 and a published release 1.3.0
- **WHEN** the periodic update check runs
- **THEN** the APK is downloaded and verified
- **AND** a high-priority notification "Update available: tap to install"
  is shown, opening the Android package installer on tap

### Requirement: Telemetry parity with Windows agent

The Android agent SHALL emit identically structured `session-event`
documents (focus-start, focus-end, warning-shown, force-close,
tamper-attempt, sync-error, agent-start, agent-stop) so dashboard
visualizations are platform-agnostic.

#### Scenario: Identical event shape

- **WHEN** a focus session of 4 minutes ends on Android
- **THEN** the emitted `focus-end` event has the same JSON schema as the
  equivalent event from Windows (same field names, types, units)

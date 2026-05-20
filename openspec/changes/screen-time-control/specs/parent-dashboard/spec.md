## ADDED Requirements

### Requirement: Google sign-in authentication

The dashboard SHALL use Firebase Authentication with the Google sign-in
provider as the only enabled provider. Unauthenticated visitors SHALL be
shown a sign-in page and SHALL NOT be able to load any family data.

#### Scenario: Anonymous visit

- **WHEN** a user visits the dashboard URL without an active session
- **THEN** they see only a "Sign in with Google" button and product info
- **AND** no Firestore reads are attempted

#### Scenario: Sign-in completes

- **WHEN** the user signs in with Google
- **THEN** the dashboard resolves their `familyId` (creating the family on
  first sign-in) and renders the dashboard home with the children list

### Requirement: Children and devices management UI

The dashboard SHALL provide CRUD UIs for child profiles (create, rename,
archive) and devices (view, unpair). Each child card SHALL show today's
total minutes vs. budget and an "Add device" button that generates a
pairing code.

#### Scenario: Add device flow

- **WHEN** the parent clicks "Add device" on a child card
- **THEN** a modal shows a 6-character pairing code with a live 10-minute
  countdown
- **AND** copy-to-clipboard works
- **AND** when redeemed by a child device, the modal auto-closes and the
  new device appears in the device list

### Requirement: Rules editor

The dashboard SHALL provide a per-child rules editor allowing the parent
to:

- Add/edit/remove app targets (paste/upload icon, set platform, set
  category, set per-target quota).
- Add/edit/remove URL pattern targets (with live syntax validation and a
  test-string field).
- Edit the global daily schedule per weekday (visual time-range picker).
- Edit the total daily screen-time budget per weekday.
- Override default warning lead time and grace period (global and
  per-target).

Saving SHALL write a new `rules/current` document with the incremented
version.

#### Scenario: Edit a URL target

- **GIVEN** existing URL target `youtube.com` → LIMITED, quota 60 min
- **WHEN** the parent changes the daily quota for Wednesday to 30 min and
  saves
- **THEN** a new `rules/current` document is written
- **AND** the dashboard shows "Rules updated. Devices syncing…" toast
- **AND** the child's device receives the new rules within 5 seconds and
  applies them immediately

#### Scenario: Invalid URL pattern

- **WHEN** the parent enters `not a url pattern!!!` in the URL field
- **THEN** the field shows an inline validation error and the save button
  is disabled

### Requirement: Usage visualization

The dashboard SHALL render, per child:

- A daily timeline (today by default, configurable date) with stacked
  bars per app/URL showing focus minutes.
- A weekly summary chart (last 7 days) with total minutes vs. budget per
  day.
- A per-target breakdown table sorted by minutes used today.
- A timeline of warning-shown and force-close events.
- A list of recent tamper-attempt and sync-error events with timestamps
  and device IDs.

#### Scenario: Today's timeline

- **WHEN** the parent opens the child's dashboard
- **THEN** within 2 seconds the dashboard shows today's stacked timeline
  using events from `families/{familyId}/children/{childId}/dailyRollups/
  {YYYY-MM-DD}` (or live-aggregates from `events/*` if the rollup is
  unavailable)

### Requirement: Temp-unlock issuance UI

The dashboard SHALL provide a "Temp unlock" button per device. Clicking it
SHALL open a form with:

- Duration: 5 / 15 / 30 / 60 min (preset) or custom up to 240 min.
- Scope: schedule-only / schedule + quotas / add minutes (with target
  selector and amount).
- Reason note (free text, audited).

Submitting SHALL create a `temp-unlocks/{unlockId}` document; the device
SHALL apply it within 5 seconds via the real-time listener.

#### Scenario: 15-min schedule bypass

- **WHEN** the parent grants 15 min, scope = schedule-only, to Alex's
  phone
- **THEN** a `temp-unlocks/{unlockId}` is created with `deviceId`,
  `scope`, `expiresAt = now + 15min`, `issuedByUid`
- **AND** the device's LockoutActivity (if active because outside
  schedule) is dismissed within 5 seconds
- **AND** the dashboard shows a live "Unlocked: 14m 52s remaining" badge

#### Scenario: Revoke an active unlock

- **WHEN** the parent clicks "Revoke" on an active temp-unlock
- **THEN** `revoked = true` is set, and the device re-applies normal rules
  within 5 seconds

### Requirement: Family settings

The dashboard SHALL provide a Settings page for:

- Family display name.
- Parent PIN (4–8 digits) used by child-device tray/settings access.
- Invite additional parents by email.
- View Firebase project ID and a "Download diagnostics" button (dumps
  rules and recent events as JSON).

#### Scenario: Set parent PIN

- **GIVEN** no PIN is set
- **WHEN** the parent saves a 6-digit PIN
- **THEN** `families/{familyId}/private/secrets` is updated with a hashed
  PIN (bcrypt) and verified by child devices via a Cloud Function

### Requirement: Responsive layout

The dashboard SHALL be usable on mobile phone screen widths (>= 360 px)
with no horizontal scrolling. Critical actions (temp-unlock, view today's
usage) SHALL be reachable within 2 taps from the home screen on mobile.

#### Scenario: Mobile temp-unlock

- **WHEN** the parent opens the dashboard on a 375-px-wide screen
- **AND** taps a child card, then taps "Temp unlock" on a device
- **THEN** the temp-unlock form is fully usable without horizontal
  scrolling

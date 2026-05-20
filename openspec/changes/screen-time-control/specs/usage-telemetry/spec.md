## ADDED Requirements

### Requirement: Session-event document schema

The system SHALL define a unified `session-event` document shape used by
both agents, stored at
`families/{familyId}/devices/{deviceId}/events/{autoId}`.

Required fields:
- `eventType`: one of `focus-start`, `focus-end`, `warning-shown`,
  `force-close`, `tamper-attempt`, `sync-error`, `agent-start`,
  `agent-stop`, `temp-unlock-applied`, `temp-unlock-expired`,
  `url-read-failed`.
- `at`: client-recorded ISO-8601 timestamp + timezone offset.
- `serverAt`: Firestore server timestamp (set on write).
- `localDate`: `YYYY-MM-DD` (child's local date for rollup keying).
- `childId`, `deviceId`, `platform`, `agentVersion`.
- `app`: { `id`, `displayName`, `platformId` (executable or package) }.
- `url?`: { `pattern`, `hostname`, `path` } when applicable.
- `targetId`: resolved target id (or `"__unknown__"`).
- `category`: `BLOCKED` | `LIMITED` | `ALLOWED`.
- For `focus-end`: `durationMs`, `endedReason`
  (`user-switched`, `forced-close`, `agent-stopped`, `idle-cutoff` —
  reserved for future).
- For `warning-shown`: `remainingMinutes`, `warningKind` (`toast` |
  `modal`).
- For `force-close`: `closeMethod` (`tab` | `process-terminate` |
  `home-intent`).

#### Scenario: focus-end event written

- **WHEN** a 4-minute focus session on Chrome ends because the user
  switched
- **THEN** a `focus-end` document is written with `durationMs = 240000`,
  `endedReason = "user-switched"`, full `app` + `url` + `targetId` +
  `category` data, and a `localDate` matching the device's local day at
  the time the session ended

### Requirement: Daily rollup documents

A scheduled Cloud Function SHALL aggregate the previous day's events at
00:30 local time (per child timezone) into
`families/{familyId}/children/{childId}/dailyRollups/{YYYY-MM-DD}`. The
rollup SHALL contain:

- `totalLimitedMinutes`, `totalAllowedMinutes`, `totalBlockedAttempts`.
- `perTarget[targetId] = { minutes, sessions }`.
- `warnings[targetId] = count`, `forceCloses[targetId] = count`.
- `scheduleAdherence`: `{ insideScheduleMinutes, outsideScheduleMinutes
  }`.
- `tamperAttempts`: count.
- `firstActivityAt`, `lastActivityAt`.

#### Scenario: Rollup generated nightly

- **GIVEN** events from yesterday exist in Firestore for child Alex
- **WHEN** the rollup function runs at 00:30 local time
- **THEN** `dailyRollups/{yesterday}` is created with all aggregations
- **AND** the dashboard reads the rollup (one document) instead of
  scanning thousands of events

### Requirement: Live "today" aggregation

The dashboard SHALL compute today's totals client-side via a Firestore
real-time subscription on
`families/{familyId}/devices/{deviceId}/events/` filtered by
`localDate == today` AND `at >= startOfDayLocal`, updating the UI within
1 second of new events.

#### Scenario: Live update

- **GIVEN** the dashboard is open showing today's stats
- **WHEN** a `focus-end` event is written by an agent
- **THEN** the timeline and per-target table update within 1 second

### Requirement: Event purge policy

Each agent SHALL purge local SQLite/Room-cached events older than 7 days
ONLY after Firestore has confirmed write success. Firestore retention is
governed by a Cloud Function that deletes raw `events/*` older than 90
days (rollups are retained indefinitely).

#### Scenario: Event aged out of Firestore

- **GIVEN** an event with `serverAt` 91 days ago
- **WHEN** the cleanup function runs
- **THEN** the raw event document is deleted, the corresponding daily
  rollup is preserved

### Requirement: Sync-error reporting

The agent SHALL retry failed Firestore writes (network, permission,
quota) with exponential backoff (1s, 2s, 4s, …, capped at 5 min) and
MUST surface a tray/notification alert "Sync failing — check Firebase
project." after 24 hours of continuous failure.

#### Scenario: 24h sync failure alert

- **WHEN** sync has failed continuously for 24 hours
- **THEN** the Windows tray icon shows a red badge and a balloon
  notification; the Android persistent notification updates to
  "Sync failing — tap for help"

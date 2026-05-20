## ADDED Requirements

### Requirement: Three-level activity categorization

The system SHALL classify every observed activity (app or URL) into exactly
one of three categories:

- `BLOCKED`: Never allowed. Forced-close immediately on focus.
- `LIMITED`: Counts toward the daily total screen-time budget and toward
  any per-target quota. Subject to the global daily schedule.
- `ALLOWED`: Does not count toward screen time. Usable any time, including
  outside the global daily schedule.

Items not explicitly listed in the rules SHALL default to `LIMITED`.

#### Scenario: Default category for unknown app

- **GIVEN** an empty rules set
- **WHEN** the child opens an app whose identifier is not in any target list
- **THEN** the rules engine returns category `LIMITED`

#### Scenario: Explicit BLOCKED takes precedence over LIMITED

- **GIVEN** an app target classified `BLOCKED` and a URL pattern under that
  app classified `LIMITED`
- **WHEN** the child focuses any URL inside that app
- **THEN** the engine returns `BLOCKED` (app-level decision dominates)

### Requirement: App targets

The system SHALL identify Windows apps by `executable name` (case-insensitive,
e.g., `chrome.exe`) with optional `windowTitlePattern` (regex) for
disambiguation, and Android apps by `package name` (e.g.,
`com.spotify.music`).

Each app target document SHALL contain `id`, `platform`
(`windows` | `android` | `any`), `matcher` (the executable or package),
`displayName`, `iconUrl?`, and `category`.

#### Scenario: Same logical app on both platforms

- **WHEN** a parent marks "Spotify" as `ALLOWED` with platform `any` and
  matchers `chrome.exe?` no — uses `spotify.exe` on Windows and
  `com.spotify.music` on Android
- **THEN** the rules document holds two matcher entries (one per platform)
  but a single `targetId`
- **AND** both platforms agree on classification at runtime

### Requirement: URL pattern targets

The system SHALL support URL-pattern targets matched in priority order
(longest pattern first). Patterns SHALL support:

- Exact hostname (e.g., `youtube.com`)
- Wildcard subdomain (e.g., `*.youtube.com`)
- Hostname + path prefix (e.g., `youtube.com/shorts/`)
- Hostname + path glob (e.g., `reddit.com/r/learnprogramming/*`)

Schemes (`http://`, `https://`) and query strings SHALL be ignored for
matching.

#### Scenario: Longest-prefix match wins

- **GIVEN** target A `youtube.com` → `LIMITED` (quota 60 min) and target B
  `youtube.com/kids/` → `ALLOWED`
- **WHEN** the child navigates to `https://youtube.com/kids/watch?v=xyz`
- **THEN** the engine selects target B (`ALLOWED`) because its pattern is
  longer/more specific

#### Scenario: Wildcard subdomain matches

- **GIVEN** target `*.wikipedia.org` → `ALLOWED`
- **WHEN** the child opens `https://en.wikipedia.org/wiki/Cat`
- **THEN** the engine returns `ALLOWED`

#### Scenario: Unknown URL falls back to browser app category

- **GIVEN** browser app `chrome.exe` is `LIMITED` with no matching URL
  target
- **WHEN** the child opens `https://random-site.example`
- **THEN** the engine returns `LIMITED` and accounts time against
  `chrome.exe`

### Requirement: Per-day-of-week global schedule

The system SHALL store a global daily schedule per child per weekday
(Mon–Sun), each weekday containing zero or more `[startTime, endTime]`
windows in local time (HH:MM). LIMITED apps/URLs are only usable inside
those windows. ALLOWED apps/URLs are always usable.

#### Scenario: Inside the schedule window

- **GIVEN** today is Monday and the Monday schedule is `[09:00–20:00]`
- **WHEN** the local clock reads 14:30 and the child focuses a `LIMITED`
  app
- **THEN** the engine permits usage (subject to quotas)

#### Scenario: Outside the schedule window

- **GIVEN** the same schedule and the local clock reads 21:15
- **WHEN** the child focuses a `LIMITED` app
- **THEN** the engine returns `OUTSIDE_SCHEDULE` and the agent enforces a
  forced-close per the warning/grace settings

#### Scenario: Empty schedule for a weekday means no LIMITED usage allowed

- **GIVEN** Sunday schedule is `[]`
- **WHEN** the child focuses a `LIMITED` app on Sunday
- **THEN** the engine returns `OUTSIDE_SCHEDULE`

### Requirement: Per-day-of-week total screen-time budget

The system SHALL support a `dailyTotalMinutes` setting per child per
weekday, defaulting to `null` (no total cap). When set, the sum of focus
time across ALL `LIMITED` items SHALL NOT exceed this value.

#### Scenario: Total budget consumed across multiple apps

- **GIVEN** `dailyTotalMinutes = 120` for Wednesday
- **WHEN** the child has accumulated 75 min on Chrome + 45 min on a game
  today
- **THEN** any further LIMITED activity triggers immediate
  warning-then-close

### Requirement: Per-target daily quota

The system SHALL allow each app or URL target to optionally define a
`dailyQuotaMinutes` per weekday (or a `default` value applied to all days).
A target's quota is independent of and additional to the global daily total.

#### Scenario: Per-target quota reached before total

- **GIVEN** `LIMITED` URL `youtube.com` with `dailyQuotaMinutes.default = 30`
  and `dailyTotalMinutes = 180`
- **WHEN** the child has spent 30 min on `youtube.com` today and 0 min
  elsewhere
- **THEN** the engine returns `TARGET_QUOTA_REACHED` for further YouTube
  focus
- **AND** other LIMITED apps remain usable until the 180-min total is hit

### Requirement: Configurable warning lead time and grace period

The system SHALL support per-rule (and global default) `warningLeadMinutes`
(default 5) and `gracePeriodSeconds` (default 120). When projected time
remaining ≤ `warningLeadMinutes`, the agent SHALL show a toast warning.
When the limit is reached, the agent SHALL show a topmost countdown dialog
for `gracePeriodSeconds`, then force-close.

#### Scenario: Toast warning at 5 minutes remaining

- **GIVEN** default warning lead time of 5 minutes
- **WHEN** the child has 5:00 minutes of quota remaining and focuses the
  target
- **THEN** the agent emits a toast notification "5 minutes remaining on
  Chrome"

#### Scenario: Modal dialog and forced close

- **GIVEN** default grace period of 120 seconds
- **WHEN** the quota reaches 0 while the child is still focused
- **THEN** the agent shows a topmost modal with a 120-second countdown and
  the text "Time's up. Saving... Close in 02:00"
- **AND** when the countdown ends, the agent force-closes the target
  (closes the tab or the entire app per platform capability)

### Requirement: Local-midnight day rollover

The system SHALL reset all "today's usage" counters at local midnight in
the device's timezone. In-progress sessions SHALL continue uninterrupted;
the portion of focus time after midnight counts toward the new day.

#### Scenario: Session spans midnight

- **GIVEN** the child started a focused session at 23:50 with no quota
  triggering by midnight
- **WHEN** the local clock crosses 00:00:00
- **THEN** the agent does NOT forcibly close the app
- **AND** time after 00:00 is logged against the new calendar date
- **AND** the new day's quota check starts fresh

### Requirement: Rules document shape and versioning

The system SHALL store rules at
`families/{familyId}/children/{childId}/rules/current` with a monotonically
increasing `version` integer, an `updatedAt` server timestamp, the editing
`parentUid`, and the full ruleset (targets, schedule, totals, per-target
quotas, warning/grace defaults). Agents SHALL cache the last-seen version
locally and discard cache when a higher version arrives.

#### Scenario: Parent edits rules

- **WHEN** a parent saves a rule change
- **THEN** the dashboard writes a new `rules/current` document with
  `version = previousVersion + 1` and the change is propagated to all the
  child's devices within 5 seconds

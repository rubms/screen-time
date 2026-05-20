## ADDED Requirements

### Requirement: Pure deterministic decision function

The system SHALL expose a pure function `decide(activity, rules, usage,
nowLocal, tempUnlocks) -> Decision` with no I/O, no clock access, and no
mutable state. The function SHALL be implemented in TypeScript (reference)
and ported to Python and Kotlin, with identical behavior validated by a
shared fixture suite.

`Decision` SHALL be one of:
- `{ kind: "ALLOWED" }`
- `{ kind: "LIMITED_OK", remainingMinutes: number, warnAt: number }`
- `{ kind: "WARN", remainingMinutes: number, reason }`
- `{ kind: "OUT_OF_TIME", reason }` — must warn-then-close
- `{ kind: "OUTSIDE_SCHEDULE" }` — must warn-then-close
- `{ kind: "BLOCKED" }` — must close immediately

#### Scenario: Pure function with no side effects

- **WHEN** `decide` is called twice with identical inputs
- **THEN** both calls return structurally equal `Decision` objects
- **AND** no global state is modified
- **AND** no network or filesystem access occurs

#### Scenario: Parity across language ports

- **GIVEN** the shared fixture file
  `packages/shared-rules-engine/fixtures/cases.json` with N input/output
  cases
- **WHEN** each port (TS, Python, Kotlin) runs all N cases
- **THEN** all three produce the same `Decision` for every case, validated
  by per-port parity tests in CI

### Requirement: Activity resolution

The system SHALL resolve an observed `Activity` into a single matched
target using the priority order:

1. URL target with the longest matching pattern (only if the focused app is
   a recognized browser and a URL is known)
2. App target (exact platform match, then `platform = "any"`)
3. Implicit `LIMITED` fallback (`targetId = "__unknown__"`)

A `BLOCKED` app target SHALL dominate any URL-level decision.

#### Scenario: BLOCKED app overrides URL

- **GIVEN** browser `chrome.exe` is `BLOCKED` and URL `youtube.com/kids/` is
  `ALLOWED`
- **WHEN** the activity is `{ app: "chrome.exe", url:
  "youtube.com/kids/abc" }`
- **THEN** the resolved target is the app target and the decision is
  `BLOCKED`

### Requirement: Quota arithmetic

The system SHALL compute `remainingMinutes` as the minimum of:

- `(dailyTotalMinutes ?? +∞) - sumLimitedUsageToday`
- `(target.dailyQuotaMinutes[dow] ?? target.dailyQuotaMinutes.default ?? +∞)
  - usageToday[targetId]`
- `(secondsUntilCurrentScheduleWindowEnds / 60)` if currently inside a
  schedule window
- `(temp-unlock additionalMinutes if scoped to this target or "total")`

If any input is +∞ across all four, the result is +∞ (no warn, no close).

#### Scenario: Schedule window end is closer than quota

- **GIVEN** quota remaining 45 minutes and current time is 19:30 with
  schedule ending at 20:00
- **WHEN** `decide` is called
- **THEN** `remainingMinutes = 30`
- **AND** `warnAt` = `30 - warningLeadMinutes` (which is 25 at default
  lead-time of 5 min)

### Requirement: Temp-unlock application

The system SHALL apply active `temp-unlock` records (non-expired, not
revoked) by:

- `scope = "schedule"`: ignore `OUTSIDE_SCHEDULE` for the unlock duration.
- `scope = "schedule+quotas"`: ignore schedule AND all quotas (total and
  per-target) for the duration.
- `scope = "add-minutes"`: add `additionalMinutes` to either the global
  total budget for today or to a specific target's quota for today, per
  the `target` field.

#### Scenario: Schedule-only temp unlock at night

- **GIVEN** local time is 22:00, schedule ended at 20:00, and an active
  `scope = "schedule"` temp-unlock valid for 30 more minutes
- **WHEN** the child focuses a `LIMITED` app
- **THEN** the decision is `LIMITED_OK` (quotas still apply) instead of
  `OUTSIDE_SCHEDULE`

#### Scenario: Extra-minutes temp unlock for a specific target

- **GIVEN** YouTube quota of 30 min has been fully consumed and a
  temp-unlock `{ scope: "add-minutes", target: "youtube.com",
  additionalMinutes: 15 }`
- **WHEN** the child focuses YouTube
- **THEN** decision is `LIMITED_OK` with `remainingMinutes = 15` (assuming
  no other limits bind)

### Requirement: Deterministic browser app detection

The system SHALL maintain a built-in list of browser app matchers
(`chrome.exe`, `msedge.exe`, `firefox.exe`, `brave.exe`, `opera.exe`, and
Android counterparts `com.android.chrome`, `com.microsoft.emmx`,
`org.mozilla.firefox`, etc.). Only when the foreground app matches this
list AND the agent has provided a URL SHALL URL targets be considered.

#### Scenario: Non-browser app with URL field is ignored

- **WHEN** an activity is `{ app: "notepad.exe", url: "anything" }`
- **THEN** URL targets are not consulted and resolution uses app targets
  only

### Requirement: Idle handling

The rules engine SHALL NOT factor idle time. Focus time is counted at full
rate whenever the activity is in focus, regardless of input activity. (Idle
detection is explicitly out of scope per design.)

#### Scenario: No keyboard activity, app in focus

- **GIVEN** an app is in focus for 10 minutes with zero keyboard/mouse
  events
- **WHEN** `decide` is consulted continuously
- **THEN** quota deduction proceeds as if the user were active

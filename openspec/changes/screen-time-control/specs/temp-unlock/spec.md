## ADDED Requirements

### Requirement: Temp-unlock document model

The system SHALL store temp-unlocks at
`families/{familyId}/temp-unlocks/{unlockId}` with fields:

- `deviceId` (required).
- `childId` (denormalized for security rules).
- `scope`: `schedule` | `schedule+quotas` | `add-minutes`.
- For `add-minutes`: `target`: `"total"` | `<targetId>`; `additionalMinutes`
  (1–240).
- `durationMinutes` (1–240, ignored for `add-minutes`).
- `issuedAt` (server timestamp), `expiresAt` (server timestamp),
  `issuedByUid`, `reason?`, `revoked` (default false), `revokedAt?`,
  `revokedByUid?`.

#### Scenario: Document shape validated by Cloud Function

- **WHEN** the dashboard writes a temp-unlock document directly that
  violates the schema (e.g., `durationMinutes = 9999`)
- **THEN** a Cloud Function trigger denies the write or auto-revokes it
  and emits an audit event

### Requirement: Real-time propagation to device

Each child agent SHALL maintain a Firestore real-time listener on its
own active `temp-unlocks` (filtered by `deviceId == self` AND
`expiresAt > now` AND `revoked == false`). Newly issued temp-unlocks
SHALL be applied to the rules engine within 5 seconds end-to-end.

#### Scenario: Issued unlock takes effect

- **GIVEN** a device is in lockout (outside schedule)
- **WHEN** the parent issues a 15-min schedule unlock
- **THEN** within 5 seconds the device dismisses the lockout overlay and
  resumes normal LIMITED-with-quota operation

### Requirement: Multiple concurrent unlocks compose

The system SHALL compose multiple active temp-unlocks applied to the
same device by adding `additionalMinutes` for `add-minutes` unlocks and
taking the union of `scope` semantics (the most permissive wins between
`schedule` and `schedule+quotas`).

#### Scenario: Schedule unlock + add-minutes for YouTube

- **GIVEN** an active `scope = "schedule"` unlock AND an active
  `scope = "add-minutes", target = "youtube.com", additionalMinutes =
  20` unlock
- **WHEN** the child opens YouTube outside the normal schedule
- **THEN** the rules engine returns `LIMITED_OK` with
  `remainingMinutes = 20`

### Requirement: Revocation

The parent SHALL be able to revoke an active unlock at any time. Setting
`revoked = true` SHALL cause the device to re-apply normal rules within 5
seconds. Already-consumed `add-minutes` cannot be "un-consumed" (revocation
caps further use; usage already counted stays counted).

#### Scenario: Revoke active unlock

- **GIVEN** an active unlock with 10 minutes remaining
- **WHEN** the parent clicks "Revoke"
- **THEN** the document is updated and the device's listener fires
- **AND** within 5 seconds, if the device is now outside schedule or over
  quota, the warning-then-close flow starts immediately

### Requirement: Expiry handling

When `expiresAt` passes, the agent SHALL emit a `temp-unlock-expired`
event and resume normal enforcement. If the child is actively using a
LIMITED app at expiry, the warning-then-close flow SHALL start.

#### Scenario: Expiry mid-use

- **GIVEN** a 15-min schedule unlock is active and the schedule window
  is closed
- **WHEN** the unlock expires while the child is using YouTube
- **THEN** the agent emits `temp-unlock-expired`, shows the modal
  countdown (default 120s grace), and force-closes if not abandoned

### Requirement: Audit trail

Every temp-unlock issuance and revocation SHALL be auditable in the
dashboard's per-child event timeline, including `issuedByUid`,
`reason`, exact `scope`, and outcome (expired-naturally vs. revoked).

#### Scenario: Audit history

- **WHEN** the parent opens the child's "Unlock history" tab
- **THEN** all temp-unlocks issued in the last 30 days are listed with
  full attribution

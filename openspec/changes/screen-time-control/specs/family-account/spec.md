## ADDED Requirements

### Requirement: Family creation

The system SHALL allow exactly one Firebase project to host exactly one
`family` document at `families/{familyId}`. On first sign-in to the parent
dashboard, the system SHALL create the family document automatically, with
`createdAt`, `ownerUid`, and a generated `familyId`.

#### Scenario: First parent sign-in creates the family

- **GIVEN** a freshly provisioned Firebase project with no `families/*`
  documents
- **WHEN** a user signs in to the dashboard with Google for the first time
- **THEN** the system creates `families/{familyId}` with `ownerUid` set to
  the user's UID, `createdAt` set to server timestamp, and `displayName`
  defaulted to the user's Google display name
- **AND** the user is granted the `parent` role for that family

#### Scenario: Subsequent parent sign-in reuses the family

- **GIVEN** a family already exists with `ownerUid = U1`
- **WHEN** user `U1` signs in again
- **THEN** the system does NOT create a new family document
- **AND** the dashboard loads the existing family

### Requirement: Parent role membership

The system SHALL support multiple parent users per family, all with equal
read/write permissions, via `families/{familyId}/parents/{uid}` documents.

#### Scenario: Owner invites a second parent

- **WHEN** the family owner enters another parent's Google email and clicks
  "Invite"
- **THEN** the system creates `families/{familyId}/parents/{invitedUid}`
  once the invited parent first signs in via the invite link
- **AND** the invited parent can read and write all family data
- **AND** the invited parent CANNOT remove the owner

#### Scenario: Non-member parent cannot read family

- **GIVEN** a signed-in Google user with no `parents/{uid}` document in any
  family
- **WHEN** they attempt to query `families/{anyId}/*`
- **THEN** Firestore security rules deny the read

### Requirement: Child profile management

The system SHALL allow parents to create, rename, and archive child profiles
under `families/{familyId}/children/{childId}`, each with `displayName`,
`avatarColor`, `timezone`, and `archived` flag.

#### Scenario: Parent creates a child

- **WHEN** a parent submits a new child name "Alex"
- **THEN** a `children/{childId}` document is created with
  `displayName = "Alex"` and `archived = false`
- **AND** the child appears in the dashboard's children list

#### Scenario: Archived child stops receiving enforcement

- **WHEN** a parent archives a child profile
- **THEN** the child's devices receive a Firestore update setting their
  rules to "no enforcement" within 60 seconds
- **AND** historical telemetry for the child is preserved

### Requirement: Device pairing via one-time code

The system SHALL allow a parent to generate a 6-character alphanumeric
pairing code (uppercase, excluding ambiguous characters O/0/I/1), bound to a
specific child, valid for 10 minutes, single-use. A child device SHALL
exchange this code for a Firebase Auth custom token via a Cloud Function and
become bound to that child.

#### Scenario: Generate a pairing code

- **WHEN** a parent clicks "Add device" for child "Alex"
- **THEN** the dashboard displays a 6-character code (e.g., `H7K3PQ`) with
  a visible 10-minute countdown
- **AND** a `families/{familyId}/pairingCodes/{code}` document exists with
  `childId`, `expiresAt`, and `redeemed = false`

#### Scenario: Child device redeems a valid code

- **GIVEN** a valid, unexpired, unredeemed pairing code
- **WHEN** the child device sends the code, a generated `deviceId`, and
  platform info (`os = "windows"` or `"android"`) to the `redeemPairingCode`
  Cloud Function
- **THEN** the function creates `families/{familyId}/devices/{deviceId}`
  with `childId`, `platform`, `installedVersion`, `pairedAt`
- **AND** marks the pairing code `redeemed = true`
- **AND** returns a Firebase custom token whose claims include
  `familyId`, `childId`, `deviceId`, `role = "device"`

#### Scenario: Expired pairing code is rejected

- **GIVEN** a pairing code whose `expiresAt` is in the past
- **WHEN** the device attempts to redeem it
- **THEN** the Cloud Function returns HTTP 410 Gone
- **AND** no device document is created

#### Scenario: Already-redeemed code is rejected

- **GIVEN** a pairing code with `redeemed = true`
- **WHEN** any device attempts to redeem it
- **THEN** the Cloud Function returns HTTP 409 Conflict

### Requirement: Multiple devices per child

The system SHALL allow N devices (mixed Windows + Android) per child, all
sharing the same rules document. Rule changes SHALL propagate to all of a
child's devices within 5 seconds while online.

#### Scenario: Same child paired on phone and PC

- **GIVEN** child "Alex" with one Windows device already paired
- **WHEN** a new Android device is paired for "Alex"
- **THEN** both devices appear under "Alex" in the dashboard
- **AND** both devices receive identical rules from
  `families/{familyId}/children/{childId}/rules/current`

### Requirement: Device unpair / replace

The system SHALL allow a parent to unpair a device, which revokes its custom
token claims, marks the device document `revoked = true`, and prevents
further sync.

#### Scenario: Parent unpairs a lost device

- **WHEN** a parent clicks "Unpair" on a device
- **THEN** the device document is marked `revoked = true`
- **AND** within 60 seconds the device's listener fires and the agent shuts
  down with a "Device unpaired" tray notification
- **AND** subsequent Firestore writes from the device are denied by
  security rules

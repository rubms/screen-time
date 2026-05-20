# Firebase backend

Per-family Firebase project hosting Firestore, Cloud Functions, and Hosting for the parent dashboard.

## Layout

| Path | Purpose |
|------|---------|
| `firestore.rules` | Security rules (parent vs device roles) |
| `firestore.indexes.json` | Composite indexes |
| `firebase.json` | Emulator ports, hosting rewrites, functions predeploy |
| `functions/` | TypeScript Cloud Functions (`@screen-time-control/functions`) |

## Functions

- `redeemPairingCode` — device pairing + custom token
- `validateTempUnlock` — schema validation on unlock writes
- `rollupDaily` — nightly usage rollups per child timezone
- `cleanupOldEvents` — 90-day event retention
- `getUpdateManifest` — GitHub Releases proxy for agents
- `verifyParentPin` — bcrypt PIN check with rate limiting

## Data model

See `openspec/changes/screen-time-control/design.md` § Firestore Data Model.

Top-level paths under `families/{familyId}/`:

- `parents/{uid}`, `children/{childId}`, `devices/{deviceId}`
- `children/{childId}/rules/current`
- `children/{childId}/dailyRollups/{YYYY-MM-DD}`
- `devices/{deviceId}/events/{eventId}`
- `temp-unlocks/{unlockId}`, `pairingCodes/{code}`
- `private/secrets` (parent PIN hash)

## Local development

```bash
npm exec pnpm@9.15.0 install
cd firebase/functions && npm exec pnpm@9.15.0 test
firebase emulators:start --only auth,firestore,functions,hosting
```

Integration tests (requires Java for Firestore emulator):

```bash
cd firebase/functions && npm exec pnpm@9.15.0 run test:emulators
```

## Deploy

```bash
./scripts/firebase-setup.sh --list
./scripts/firebase-setup.sh screen-time-54d26   # use your real Project ID
# or: ./scripts/firebase-setup.sh screen-time      # resolves display name → ID

./scripts/firebase-setup.sh --new my-unique-id    # only when creating a new project
```

Manual deploy (after `firebase/.firebaserc` points at your project):

```bash
firebase deploy --only firestore:rules,firestore:indexes,functions,hosting
```

Set `UPDATE_REPO=owner/screen-time-control` on Cloud Functions for agent updates.

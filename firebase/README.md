# Firebase backend

Per-family Firebase project hosting Firestore, Cloud Functions, and Hosting for the parent dashboard.

## Layout

| Path                     | Purpose                                                       |
| ------------------------ | ------------------------------------------------------------- |
| `firestore.rules`        | Security rules (parent vs device roles)                       |
| `firestore.indexes.json` | Composite indexes                                             |
| `firebase.json`          | Emulator ports, hosting rewrites, functions predeploy         |
| `functions/`             | TypeScript Cloud Functions (`@screen-time-control/functions`) |

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

Requires **Blaze (pay-as-you-go)** for Cloud Functions.

```bash
./scripts/firebase-setup.sh --list
./scripts/firebase-setup.sh screen-time-54d26   # use your real Project ID
```

Manual deploy (after `firebase/.firebaserc` points at your project):

```bash
cd firebase
bash scripts/build-functions.sh
firebase deploy --only firestore:rules,functions,hosting --project screen-time-54d26
```

From repo root (dashboard build + hosting):

```bash
pnpm run build:hosting
cd firebase && firebase deploy --only functions,hosting
```

Functions deploy to **`europe-west1`** (same region as Firestore). After a region
change, redeploy functions; old `us-central1` copies can be deleted in the console.

After deploy, **Functions** in the console should list: `ensureFamilyProfile`,
`redeemPairingCode`, `verifyParentPin`, `getUpdateManifest`, `rollupDaily`,
`cleanupOldEvents`, `validateTempUnlock`.

Set `UPDATE_REPO=owner/screen-time-control` on Cloud Functions for agent updates.

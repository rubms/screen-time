# Parent dashboard (`@screen-time-control/web-dashboard`)

React + Vite + Firebase web app for managing children, rules, pairing, and temp-unlocks.

## Prerequisites

- Node 20+
- pnpm 9 (`npm exec pnpm@9.15.0`)
- A Firebase project with Auth (Google), Firestore, Functions, and Hosting enabled

## Setup

```bash
cd /path/to/screen-time-control
npm exec pnpm@9.15.0 install
cp apps/web-dashboard/.env.example apps/web-dashboard/.env
# Fill VITE_FIREBASE_* from Firebase console
```

## Development

```bash
# From repo root (recommended)
pnpm install
pnpm run build:dashboard
pnpm run dev:dashboard

# If you use npm exec, put `--` before pnpm flags:
npm exec --yes pnpm@9.15.0 -- --filter @screen-time-control/web-dashboard run dev

# Or from this app directory:
cd apps/web-dashboard && pnpm run dev
```

Open http://localhost:5173 and sign in with Google.

### Against Firebase emulators

```bash
cd firebase
firebase emulators:start --only auth,firestore,functions,hosting
```

Set `VITE_USE_EMULATORS=true` in `.env` (see `.env.example`).

## Build & deploy

```bash
pnpm run build:hosting
cd firebase && firebase deploy --only hosting
```

(`build:hosting` builds the app and copies `dist/` into `firebase/hosting-public/`, which Firebase requires to be inside the `firebase/` folder.)

## Tests

```bash
pnpm --filter @screen-time-control/web-dashboard run test
pnpm --filter @screen-time-control/web-dashboard run test:e2e
```

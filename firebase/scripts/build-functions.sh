#!/usr/bin/env bash
# Compile Cloud Functions without "npm run" (avoids npm stdin bug when Firebase CLI runs predeploy).
set -euo pipefail
cd "$(dirname "$0")/../functions"

if [[ ! -x node_modules/.bin/tsc ]]; then
  echo "==> Installing function dependencies (one-time)"
  npm install --no-audit --no-fund
fi

echo "==> Compiling functions (tsc)"
node_modules/.bin/tsc -p tsconfig.json
echo "==> Build OK: functions/lib/"

#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npm exec --yes pnpm@9.15.0 --filter @screen-time-control/shared-schemas run gen
if ! git diff --exit-code packages/shared-schemas/src packages/shared-schemas/python packages/shared-schemas/kotlin; then
  echo "Generated schema outputs changed — commit them or fix generator"
  exit 1
fi
echo "gen:all produced no diff"

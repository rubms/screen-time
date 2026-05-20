#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> TypeScript rules-engine tests"
cd packages/shared-rules-engine
npm exec --yes pnpm@9.15.0 test

echo "==> Python parity"
cd "$ROOT/apps/windows-agent"
if command -v poetry >/dev/null 2>&1; then
  poetry run pytest tests/test_parity.py -q
else
  PYTHONPATH=src python3 -m pytest tests/test_parity.py -q
fi

echo "==> Kotlin parity"
cd "$ROOT/apps/android-agent"
chmod +x gradlew
./gradlew :app:testDebugUnitTest --tests "com.screentimecontrol.agent.rules.FixtureParityTest" -q

echo "All parity checks passed"

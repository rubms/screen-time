#!/usr/bin/env bash
# Copy Vite build output into firebase/hosting-public (required: inside firebase/ dir).
set -euo pipefail

FIREBASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$FIREBASE_DIR/../apps/web-dashboard/dist"
DEST="$FIREBASE_DIR/hosting-public"

if [[ ! -f "$SRC/index.html" ]]; then
  echo "Dashboard build missing. From repo root run:"
  echo "  pnpm run build:dashboard"
  exit 1
fi

rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$SRC/." "$DEST/"
echo "Synced $(du -sh "$DEST" | cut -f1) → firebase/hosting-public/"

#!/usr/bin/env bash
# Grant Cloud Functions permission to mint Firebase Auth custom tokens (device pairing).
#
# Without this, redeemPairingCode fails with:
#   Permission 'iam.serviceAccounts.signBlob' denied
#
# Usage:
#   ./scripts/grant-custom-token-signer.sh screen-time-54d26
#   ./scripts/grant-custom-token-signer.sh   # uses firebase/.firebaserc default project
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ID="${1:-}"

if [[ -z "$PROJECT_ID" && -f "$ROOT/.firebaserc" ]]; then
  PROJECT_ID="$(node -e "console.log(require('$ROOT/.firebaserc').projects.default||'')")"
fi

if [[ -z "$PROJECT_ID" ]]; then
  echo "Usage: $0 <firebase-project-id>"
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud CLI not found. Grant the role manually in Google Cloud Console:"
  echo "  https://console.cloud.google.com/iam-admin/iam?project=$PROJECT_ID"
  echo ""
  echo "Find the Cloud Functions runtime service account:"
  echo "  <PROJECT_NUMBER>-compute@developer.gserviceaccount.com"
  echo "Add role: Service Account Token Creator"
  echo ""
  echo "Or install gcloud and re-run this script."
  exit 1
fi

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo "==> Project: $PROJECT_ID ($PROJECT_NUMBER)"
echo "==> Runtime service account: $RUNTIME_SA"

echo "==> Granting roles/iam.serviceAccountTokenCreator (project-level)..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --condition=None \
  --quiet >/dev/null

echo "==> Granting roles/iam.serviceAccountTokenCreator (on service account itself)..."
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --project="$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --quiet >/dev/null

echo "Done. Retry device pairing (generate a fresh code in the dashboard)."

#!/usr/bin/env bash
# Provision or attach a Firebase project and deploy rules, functions, and hosting.
#
# Usage:
#   ./scripts/firebase-setup.sh                    # interactive
#   ./scripts/firebase-setup.sh screen-time-54d26  # existing project by ID
#   ./scripts/firebase-setup.sh --list             # show accessible projects
#   ./scripts/firebase-setup.sh --new my-family-id # create a new project
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FIRESTORE_LOCATION="${FIRESTORE_LOCATION:-europe-west1}"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/firebase-setup.sh [OPTIONS] [PROJECT_ID_OR_DISPLAY_NAME]

Options:
  --list              Print Firebase projects you can access and exit
  --new PROJECT_ID    Create a new Firebase project (prompts for display name)
  -h, --help          Show this help

Interactive mode (no args):
  Lists your projects, then asks for an existing project ID or display name.
  Use the Project ID column (e.g. screen-time-54d26), not only the display name.

Environment:
  FIRESTORE_LOCATION  Firestore region for new databases (default: europe-west1)
  SKIP_LOGIN=1        Skip "firebase login" when already authenticated
  SKIP_BUILD=1        Skip dashboard production build before deploy
EOF
}

trim() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

require_firebase() {
  if ! command -v firebase >/dev/null 2>&1; then
    echo "Install Firebase CLI: npm install -g firebase-tools"
    exit 1
  fi
}

# Resolve user input to a canonical projectId via firebase projects:list --json
resolve_project_id() {
  local input="$1"
  local json
  json="$(firebase projects:list --json 2>/dev/null || true)"
  if [[ -z "$json" ]]; then
    echo ""
    return 1
  fi
  PROJECTS_JSON="$json" INPUT_PROJECT="$input" node <<'NODE'
const data = JSON.parse(process.env.PROJECTS_JSON || "{}");
const input = (process.env.INPUT_PROJECT || "").trim();
const projects = data.result || [];
if (!input) process.exit(1);

const exact = projects.find((p) => p.projectId === input);
if (exact) {
  console.log(exact.projectId);
  process.exit(0);
}

const byName = projects.filter(
  (p) => (p.displayName || "").trim().toLowerCase() === input.toLowerCase(),
);
if (byName.length === 1) {
  console.log(byName[0].projectId);
  process.exit(0);
}

const partial = projects.filter(
  (p) =>
    p.projectId.includes(input) ||
    (p.displayName || "").toLowerCase().includes(input.toLowerCase()),
);
if (partial.length === 1) {
  console.log(partial[0].projectId);
  process.exit(0);
}

process.exit(1);
NODE
}

print_projects() {
  echo "==> Firebase projects you can access:"
  firebase projects:list
  echo ""
  echo "Use the Project ID (second column), e.g. screen-time-54d26 — not the display name alone."
}

write_firebaserc() {
  local project_id="$1"
  mkdir -p firebase
  cat > firebase/.firebaserc <<EOF
{
  "projects": {
    "default": "$project_id"
  }
}
EOF
}

ensure_firestore() {
  local project_id="$1"
  firebase use "$project_id" >/dev/null
  if firebase firestore:databases:list --json 2>/dev/null | grep -q '"name": "projects/'; then
    echo "==> Firestore database already exists — skipping create"
    return 0
  fi
  echo "==> Creating Firestore database in $FIRESTORE_LOCATION"
  firebase firestore:databases:create "(default)" --location="$FIRESTORE_LOCATION" || {
    echo "Note: Firestore create failed (database may already exist). Continuing."
  }
}

build_dashboard() {
  if [[ "${SKIP_BUILD:-}" == "1" ]]; then
    echo "==> SKIP_BUILD=1 — skipping dashboard build"
    if [[ ! -f apps/web-dashboard/dist/index.html ]]; then
      echo "Error: apps/web-dashboard/dist/index.html missing. Run build or unset SKIP_BUILD."
      exit 1
    fi
    return 0
  fi
  echo "==> Building web dashboard for Hosting"
  if command -v pnpm >/dev/null 2>&1; then
    pnpm install
    pnpm run build:hosting
  else
    npm exec --yes pnpm@9.15.0 install
    npm exec --yes pnpm@9.15.0 run build:hosting
  fi
}

deploy_stack() {
  local project_id="$1"
  write_firebaserc "$project_id"
  ensure_firestore "$project_id"
  build_dashboard
  echo "==> Deploying Firestore rules, indexes, Cloud Functions, and Hosting to $project_id"
  cd "$ROOT/firebase"
  firebase deploy --only firestore:rules,firestore:indexes,functions,hosting --project "$project_id"
  cd "$ROOT"
}

create_new_project() {
  local project_id="$1"
  local display_name="${2:-$project_id}"
  echo "==> Creating new Firebase project: $project_id"
  if ! firebase projects:create "$project_id" --display-name "$display_name"; then
    echo ""
    echo "Create failed. If the ID is taken, pick another ID or use an existing project:"
    print_projects
    exit 1
  fi
  deploy_stack "$project_id"
}

use_existing_project() {
  local raw_input="$1"
  local project_id

  project_id="$(resolve_project_id "$raw_input" || true)"
  if [[ -z "$project_id" ]]; then
    # User may have typed the real project ID but it is not in their account list
    if firebase use "$raw_input" >/dev/null 2>&1; then
      project_id="$raw_input"
    else
      echo "Could not resolve \"$raw_input\" to a Firebase project you can access."
      echo ""
      print_projects
      echo "Re-run with the exact Project ID, for example:"
      echo "  ./scripts/firebase-setup.sh screen-time-54d26"
      exit 1
    fi
  fi

  if [[ "$project_id" != "$raw_input" ]]; then
    echo "==> Resolved \"$raw_input\" → project ID: $project_id"
  fi

  echo "==> Using existing project: $project_id"
  deploy_stack "$project_id"
}

main() {
  require_firebase

  case "${1:-}" in
    -h | --help)
      usage
      exit 0
      ;;
    --list)
      print_projects
      exit 0
      ;;
    --new)
      shift
      if [[ $# -lt 1 ]]; then
        echo "Error: --new requires a unique project ID (globally unique, lowercase, hyphens)."
        exit 1
      fi
      NEW_ID="$(trim "$1")"
      shift
      DISPLAY="${1:-}"
      if [[ -z "$DISPLAY" ]]; then
        read -r -p "Display name for $NEW_ID: " DISPLAY
      fi
      if [[ "${SKIP_LOGIN:-}" != "1" ]]; then
        echo "==> Sign in to Firebase"
        firebase login
      fi
      create_new_project "$NEW_ID" "$(trim "$DISPLAY")"
      ;;
    "")
      if [[ "${SKIP_LOGIN:-}" != "1" ]]; then
        echo "==> Sign in to Firebase"
        firebase login
      fi
      print_projects
      read -r -p "Existing project ID or display name (or 'new' to create): " RAW
      RAW="$(trim "$RAW")"
      if [[ -z "$RAW" ]]; then
        echo "No project specified."
        exit 1
      fi
      if [[ "$RAW" == "new" ]]; then
        read -r -p "New globally-unique project ID: " NEW_ID
        NEW_ID="$(trim "$NEW_ID")"
        read -r -p "Display name: " DISPLAY
        create_new_project "$NEW_ID" "$(trim "$DISPLAY")"
      else
        use_existing_project "$RAW"
      fi
      ;;
    *)
      if [[ "${SKIP_LOGIN:-}" != "1" ]]; then
        echo "==> Sign in to Firebase"
        firebase login
      fi
      use_existing_project "$(trim "$1")"
      ;;
  esac

  echo ""
  echo "Done. Configure production env for the dashboard, then rebuild if you change .env:"
  echo "  cp apps/web-dashboard/.env.example apps/web-dashboard/.env"
  echo "  # Set VITE_FIREBASE_* from Firebase console → Project settings → Your apps"
  echo "  pnpm run build:hosting"
  echo "  cd firebase && firebase deploy --only hosting"
}

main "$@"

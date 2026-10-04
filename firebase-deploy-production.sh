#!/usr/bin/env bash

set -euo pipefail

PROJECT_ID="newfilmchat-prod"
PRODUCTION_ALIAS="production"
HOSTING_SITE="newfilmchat-prod"
HOSTING_PUBLIC_DIR="hosting"
HOSTING_URL="https://${HOSTING_SITE}.web.app"
SECRET_NAME="TMDB_READ_ACCESS_TOKEN"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

die() {
    echo "ERROR: $*" >&2
    exit 1
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

echo
echo "========================================"
echo " FilmChat - Production Deployment"
echo "========================================"
echo

# --------------------------------------------------
# 1. Verify project structure and required tools
# --------------------------------------------------

for command_name in firebase npm node python3 curl; do
    require_command "$command_name"
done

[[ -f "firebase.json" ]] || die "firebase.json not found in $SCRIPT_DIR."
[[ -f ".firebaserc" ]] || die ".firebaserc not found in $SCRIPT_DIR."
[[ -f "package.json" ]] || die "package.json not found in $SCRIPT_DIR."
[[ -f "functions/package-lock.json" ]] || die "functions/package-lock.json not found. Commit the lockfile before using npm ci."
[[ -f "hosting/invite/index.html" ]] || die "hosting/invite/index.html not found."
[[ -d "$HOSTING_PUBLIC_DIR" ]] || die "Firebase Hosting public directory '$HOSTING_PUBLIC_DIR' not found."

# --------------------------------------------------
# 2. Verify production alias and Hosting configuration
# --------------------------------------------------

echo "Checking Firebase project and Hosting configuration..."

CONFIG_VALUES="$(python3 - <<'PY'
import json
import sys

try:
    with open(".firebaserc", encoding="utf-8") as file:
        firebase_rc = json.load(file)
    with open("firebase.json", encoding="utf-8") as file:
        firebase_config = json.load(file)
except (OSError, json.JSONDecodeError) as error:
    print(f"Could not read Firebase configuration: {error}", file=sys.stderr)
    sys.exit(1)

hosting = firebase_config.get("hosting", {})
print(firebase_rc.get("projects", {}).get("production", ""))
print(hosting.get("site", ""))
print(hosting.get("public", ""))
PY
)" || die "Could not parse Firebase project configuration."

mapfile -t CONFIG_LINES <<< "$CONFIG_VALUES"
ALIAS_PROJECT="${CONFIG_LINES[0]:-}"
CONFIGURED_HOSTING_SITE="${CONFIG_LINES[1]:-}"
CONFIGURED_HOSTING_DIR="${CONFIG_LINES[2]:-}"

if [[ "$ALIAS_PROJECT" != "$PROJECT_ID" ]]; then
    die "The '$PRODUCTION_ALIAS' alias must point to '$PROJECT_ID' (found '${ALIAS_PROJECT:-<missing>}')."
fi

if [[ "$CONFIGURED_HOSTING_SITE" != "$HOSTING_SITE" ]]; then
    die "Firebase Hosting site must be '$HOSTING_SITE' (found '${CONFIGURED_HOSTING_SITE:-<missing>}')."
fi

if [[ "$CONFIGURED_HOSTING_DIR" != "$HOSTING_PUBLIC_DIR" ]]; then
    die "Firebase Hosting public directory must be '$HOSTING_PUBLIC_DIR' (found '${CONFIGURED_HOSTING_DIR:-<missing>}')."
fi

echo "✓ $PRODUCTION_ALIAS → $PROJECT_ID"
echo "✓ Hosting site → $HOSTING_SITE ($HOSTING_PUBLIC_DIR/)"
echo

# --------------------------------------------------
# 3. Run release validation
# --------------------------------------------------

echo "========================================"
echo " Running release checks"
echo "========================================"
echo

npm run release:check

echo
echo "✓ Release checks passed."
echo

# --------------------------------------------------
# 4. Verify Firebase authentication and production secret
# --------------------------------------------------

echo "Checking Firebase authentication..."
firebase login:list
echo

echo "Checking production secret..."
if ! firebase functions:secrets:access \
    "$SECRET_NAME" \
    --project "$PROJECT_ID" \
    >/dev/null 2>&1
then
    echo "ERROR: Secret '$SECRET_NAME' could not be accessed." >&2
    echo "If this is a new production project, create it with:" >&2
    echo "  firebase functions:secrets:set $SECRET_NAME --project $PROJECT_ID" >&2
    exit 1
fi

echo "✓ Secret exists and is accessible: $SECRET_NAME"
echo

# --------------------------------------------------
# 5. Build Functions before production confirmation
# --------------------------------------------------

echo "========================================"
echo " Installing and building Cloud Functions"
echo "========================================"
echo

npm --prefix functions ci
npm --prefix functions run build

echo
echo "✓ Functions build completed."
echo

# --------------------------------------------------
# 6. Require explicit confirmation before deployment
# --------------------------------------------------

echo "The following production resources will be deployed to $PROJECT_ID:"
echo "  • Firestore rules and indexes"
echo "  • Cloud Functions"
echo "  • Firebase Hosting static files from $HOSTING_PUBLIC_DIR/"
echo "  • Hosting URL: $HOSTING_URL"
echo

[[ -t 0 ]] || die "Production confirmation requires an interactive terminal; no deployment was started."

read -r -p "Type '$PROJECT_ID' to continue: " CONFIRMATION
[[ "$CONFIRMATION" == "$PROJECT_ID" ]] || die "Confirmation did not match. No deployment was started."

echo
echo "Confirmation accepted. Starting production deployment..."
echo

# --------------------------------------------------
# 7. Deploy Firestore rules and indexes
# --------------------------------------------------

echo "========================================"
echo " Deploying Firestore"
echo "========================================"
echo

firebase deploy --project "$PROJECT_ID" --only firestore

echo
echo "✓ Firestore deployment completed."
echo

# --------------------------------------------------
# 8. Deploy Cloud Functions
# --------------------------------------------------

echo "========================================"
echo " Deploying Cloud Functions"
echo "========================================"
echo

firebase deploy --project "$PROJECT_ID" --only functions

echo
echo "✓ Functions deployment completed."
echo

# --------------------------------------------------
# 9. Deploy Firebase Hosting
# --------------------------------------------------

echo "========================================"
echo " Deploying Firebase Hosting"
echo "========================================"
echo

firebase deploy --project "$PROJECT_ID" --only hosting

echo
echo "✓ Hosting deployment completed."
echo

# --------------------------------------------------
# 10. Verify deployed Functions and Hosting
# --------------------------------------------------

echo "========================================"
echo " Verifying deployed Cloud Functions"
echo "========================================"
echo

firebase functions:list --project "$PROJECT_ID"

echo
echo "Checking the live invite page at $HOSTING_URL/invite/deployment-check ..."
HOSTING_RESPONSE="$(curl --fail --silent --show-error --location --retry 3 --retry-delay 2 --max-time 20 \
    "$HOSTING_URL/invite/deployment-check")" || die "Hosting deployed, but the live invite page could not be fetched."

if ! grep -Fq "You're invited to FilmChat" <<< "$HOSTING_RESPONSE"; then
    die "Hosting responded, but the expected FilmChat invite page content was not found."
fi

echo "✓ Live invite page is responding."
echo

echo "========================================"
echo " PRODUCTION DEPLOYMENT COMPLETE"
echo "========================================"
echo
echo "Project:"
echo "  $PROJECT_ID"
echo
echo "Deployed:"
echo "  ✓ Firestore rules and indexes"
echo "  ✓ Cloud Functions"
echo "  ✓ Firebase Hosting"
echo
echo "Verified:"
echo "  ✓ $SECRET_NAME is accessible"
echo "  ✓ Cloud Functions list retrieved"
echo "  ✓ Invite page responds at $HOSTING_URL/invite/"
echo
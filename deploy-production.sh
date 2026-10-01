#!/usr/bin/env bash

set -euo pipefail

PROJECT_ID="newfilmchat-prod"
SECRET_NAME="TMDB_READ_ACCESS_TOKEN"

echo
echo "========================================"
echo " FilmChat - Production Deployment"
echo "========================================"
echo

# --------------------------------------------------
# 1. Verify project structure
# --------------------------------------------------

if [[ ! -f "firebase.json" ]]; then
    echo "ERROR: firebase.json not found."
    echo "Run this script from the FilmChat project root."
    exit 1
fi

if [[ ! -f ".firebaserc" ]]; then
    echo "ERROR: .firebaserc not found."
    exit 1
fi

if [[ ! -d "functions" ]]; then
    echo "ERROR: functions/ directory not found."
    exit 1
fi

if [[ ! -f "functions/package-lock.json" ]]; then
    echo "ERROR: functions/package-lock.json not found."
    echo "Commit the lockfile before using npm ci."
    exit 1
fi

# --------------------------------------------------
# 2. Select production Firebase project
# --------------------------------------------------

echo "Selecting Firebase production project..."

firebase use production

echo

# --------------------------------------------------
# 3. SAFETY CHECK
# --------------------------------------------------

ACTIVE_PROJECT="$(
    firebase use 2>/dev/null |
    sed -n 's/^Active Project:.*(\(.*\)).*/\1/p'
)"

if [[ "$ACTIVE_PROJECT" != "$PROJECT_ID" ]]; then
    echo
    echo "ERROR: Wrong Firebase project!"
    echo
    echo "Expected:"
    echo "  $PROJECT_ID"
    echo
    echo "Actual:"
    echo "  ${ACTIVE_PROJECT:-<unknown>}"
    echo
    echo "Deployment aborted."
    exit 1
fi

echo "✓ Firebase project: $ACTIVE_PROJECT"
echo

# --------------------------------------------------
# 4. Verify TMDb production secret
# --------------------------------------------------

echo "Checking production secret..."

if ! firebase functions:secrets:access "$SECRET_NAME" >/dev/null 2>&1; then
    echo
    echo "ERROR: Secret '$SECRET_NAME' could not be accessed."
    echo
    echo "If this is a new production project, create it with:"
    echo
    echo "  firebase functions:secrets:set $SECRET_NAME"
    echo
    exit 1
fi

echo "✓ Secret exists: $SECRET_NAME"
echo

# --------------------------------------------------
# 5. Build Functions
# --------------------------------------------------

echo "========================================"
echo " Building Cloud Functions"
echo "========================================"
echo

cd functions

npm ci
npm run build

cd ..

echo
echo "✓ Functions build completed."
echo

# --------------------------------------------------
# 6. Deploy Firestore rules + indexes
# --------------------------------------------------

echo "========================================"
echo " Deploying Firestore"
echo "========================================"
echo

firebase deploy --only firestore

echo
echo "✓ Firestore deployment completed."
echo

# --------------------------------------------------
# 7. Deploy Cloud Functions
# --------------------------------------------------

echo "========================================"
echo " Deploying Cloud Functions"
echo "========================================"
echo

firebase deploy --only functions

echo
echo "✓ Functions deployment completed."
echo

# --------------------------------------------------
# 8. Verify deployed Functions
# --------------------------------------------------

echo "========================================"
echo " Deployed Cloud Functions"
echo "========================================"
echo

firebase functions:list

echo
echo "========================================"
echo " PRODUCTION DEPLOYMENT COMPLETE"
echo "========================================"
echo
echo "Project:"
echo "  $PROJECT_ID"
echo
echo "Deployed:"
echo "  ✓ Firestore rules"
echo "  ✓ Firestore indexes"
echo "  ✓ Cloud Functions"
echo
echo "Verified:"
echo "  ✓ TMDB_READ_ACCESS_TOKEN"
echo
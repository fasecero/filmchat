#!/usr/bin/env bash

set -euo pipefail

PROJECT_ID="newfilmchat-prod"
HOSTING_SITE="newfilmchat-prod"
HOSTING_PUBLIC_DIR="hosting"
HOSTING_URL="https://${HOSTING_SITE}.web.app"
HTML_FILE="hosting/invite/index.html"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BUILD_OUTPUT="$(mktemp)"
ENVIRONMENT_OUTPUT="$(mktemp)"
trap 'rm -f "$BUILD_OUTPUT" "$ENVIRONMENT_OUTPUT"' EXIT

die() {
    echo "ERROR: $*" >&2
    exit 1
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

echo
echo "========================================"
echo " FilmChat - EAS Preview APK Build"
echo "========================================"
echo

# --------------------------------------------------
# 1. Verify tools, project files, and preview profile
# --------------------------------------------------

for command_name in eas npm node python3 grep; do
    require_command "$command_name"
done

[[ -f "package.json" ]] || die "package.json not found in $SCRIPT_DIR."
[[ -f "app.json" ]] || die "app.json not found in $SCRIPT_DIR."
[[ -f "eas.json" ]] || die "eas.json not found in $SCRIPT_DIR."
[[ -f "$HTML_FILE" ]] || die "$HTML_FILE not found."

if ! python3 - <<'PY'
import json
import sys

try:
    with open("eas.json", encoding="utf-8") as file:
        config = json.load(file)
except (OSError, json.JSONDecodeError) as error:
    print(f"Could not read eas.json: {error}", file=sys.stderr)
    sys.exit(1)

preview = config.get("build", {}).get("preview", {})
if (
    preview.get("environment") != "preview"
    or preview.get("distribution") != "internal"
    or preview.get("android", {}).get("buildType") != "apk"
):
    print("The EAS preview profile must use the preview environment, internal distribution, and Android buildType apk.", file=sys.stderr)
    sys.exit(1)
PY
then
    die "EAS preview profile validation failed."
fi

# EAS reads these from its remote preview environment. This local check
# validates release identity/configuration but does not upload local env files.
echo "Checking local production release configuration..."
npm run release:check

echo
echo "Checking EAS authentication..."
eas whoami

echo "Checking required EAS preview environment variables..."
eas env:list preview --format long > "$ENVIRONMENT_OUTPUT" \
  || die "Could not read the EAS preview environment."

for variable_name in \
    EXPO_PUBLIC_FIREBASE_API_KEY \
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN \
    EXPO_PUBLIC_FIREBASE_PROJECT_ID
do
    if ! grep -Fq "$variable_name" "$ENVIRONMENT_OUTPUT"; then
        die "EAS preview environment is missing $variable_name. Configure the three EXPO_PUBLIC_FIREBASE_* values for newfilmchat-prod in the EAS project before building."
    fi
done

echo "✓ Required EAS preview variable names are present."

[[ -t 0 ]] || die "An interactive terminal is required so you can choose whether to deploy Hosting."

# --------------------------------------------------
# 2. Build and extract the direct APK artifact URL
# --------------------------------------------------

echo
echo "Starting an Android APK build using the EAS preview environment..."
echo "The preview profile's build variables must be configured in EAS under the preview environment."
echo

eas build \
    --platform android \
    --profile preview \
    --non-interactive \
    --wait \
    --json > "$BUILD_OUTPUT"

APK_URL="$(node - "$BUILD_OUTPUT" <<'NODE'
const fs = require('node:fs');

const outputPath = process.argv[2];
let payload;
try {
  payload = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
} catch (error) {
  console.error(`Could not parse EAS JSON output: ${error.message}`);
  process.exit(1);
}

const builds = Array.isArray(payload)
  ? payload
  : Array.isArray(payload.builds)
    ? payload.builds
    : [payload];
const build = [...builds].reverse().find((candidate) =>
  String(candidate.platform).toUpperCase() === 'ANDROID'
  && (!candidate.status || candidate.status === 'FINISHED')
  && (candidate.artifacts?.buildUrl || candidate.artifacts?.applicationArchiveUrl),
);
const artifactUrl = build?.artifacts?.buildUrl || build?.artifacts?.applicationArchiveUrl;

if (!artifactUrl) {
  console.error('EAS completed without a successful Android APK artifact URL in its JSON output.');
  process.exit(1);
}

try {
  const parsedUrl = new URL(artifactUrl);
  if (parsedUrl.protocol !== 'https:') throw new Error('artifact URL is not HTTPS');
} catch (error) {
  console.error(`EAS returned an invalid APK artifact URL: ${error.message}`);
  process.exit(1);
}

process.stdout.write(artifactUrl);
NODE
)" || die "Could not retrieve a valid APK artifact URL from EAS."

[[ -n "$APK_URL" ]] || die "EAS returned an empty APK artifact URL."

# --------------------------------------------------
# 3. Atomically update only the marked APK link section
# --------------------------------------------------

echo
echo "Updating the local invite page with the preview APK link..."

node - "$HTML_FILE" "$APK_URL" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const htmlPath = process.argv[2];
const artifactUrl = process.argv[3];
const startMarker = '<!-- APK_PREVIEW_LINK_START -->';
const endMarker = '<!-- APK_PREVIEW_LINK_END -->';
const html = fs.readFileSync(htmlPath, 'utf8');
const start = html.indexOf(startMarker);
const end = html.indexOf(endMarker);

if (start === -1 || end === -1 || end < start || html.indexOf(startMarker, start + startMarker.length) !== -1 || html.indexOf(endMarker, end + endMarker.length) !== -1) {
  console.error('The invite page must contain exactly one ordered APK preview link marker pair.');
  process.exit(1);
}

const escapedUrl = artifactUrl
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');
const replacement = `${startMarker}\n    <a id="download-apk" href="${escapedUrl}">Download FilmChat Android preview (APK)</a>\n    ${endMarker}`;
const updated = `${html.slice(0, start)}${replacement}${html.slice(end + endMarker.length)}`;
const temporaryPath = path.join(path.dirname(htmlPath), `.${path.basename(htmlPath)}.${process.pid}.tmp`);

try {
  fs.writeFileSync(temporaryPath, updated, { encoding: 'utf8', mode: fs.statSync(htmlPath).mode });
  fs.renameSync(temporaryPath, htmlPath);
} catch (error) {
  try { fs.unlinkSync(temporaryPath); } catch {}
  console.error(`Could not atomically update ${htmlPath}: ${error.message}`);
  process.exit(1);
}
NODE

echo "✓ Local page updated: $HTML_FILE"
echo "APK artifact: $APK_URL"
echo

# --------------------------------------------------
# 4. Optionally deploy only Firebase Hosting
# --------------------------------------------------

read -r -p "Deploy this page to Firebase Hosting now? [y/N] " DEPLOY_CHOICE
case "$DEPLOY_CHOICE" in
    y|Y|yes|YES|Yes)
        require_command firebase
        [[ -f ".firebaserc" ]] || die ".firebaserc not found. The local page is updated but was not deployed."
        [[ -f "firebase.json" ]] || die "firebase.json not found. The local page is updated but was not deployed."

        HOSTING_CONFIG="$(python3 - <<'PY'
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
)" || die "Could not parse Firebase configuration. The local page is updated but was not deployed."

        mapfile -t HOSTING_CONFIG_LINES <<< "$HOSTING_CONFIG"
        [[ "${HOSTING_CONFIG_LINES[0]:-}" == "$PROJECT_ID" ]] || die "The production alias must point to $PROJECT_ID. The local page is updated but was not deployed."
        [[ "${HOSTING_CONFIG_LINES[1]:-}" == "$HOSTING_SITE" ]] || die "Firebase Hosting site must be $HOSTING_SITE. The local page is updated but was not deployed."
        [[ "${HOSTING_CONFIG_LINES[2]:-}" == "$HOSTING_PUBLIC_DIR" ]] || die "Firebase Hosting public directory must be $HOSTING_PUBLIC_DIR. The local page is updated but was not deployed."

        echo
        echo "Deploying only Firebase Hosting to $PROJECT_ID..."
        firebase login:list
        firebase deploy --project "$PROJECT_ID" --only hosting
        echo
        echo "✓ Hosting updated: $HOSTING_URL/invite/"
        ;;
    *)
        echo
        echo "Hosting deployment skipped. The local HTML is updated and has not been published."
        echo "To publish it later: firebase deploy --project $PROJECT_ID --only hosting"
        ;;
esac

echo
echo "EAS preview build complete."
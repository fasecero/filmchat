# FilmChat

FilmChat is a private movie discussion app for groups of friends, partners, families, and film clubs. Members can chat naturally while keeping a searchable, shared record of movie recommendations, ratings, and watch notes.

## Why this app exists

When someone recommends a movie in chat, the app creates two things at once:

1. A transient recommendation message in the group conversation
2. A persistent group-movie record that stays searchable and shareable

That gives the group a durable movie history without losing the live conversation flow. The same movie is de-duplicated within a group, and each member can add their own rating or notes.

## Core features

- Email/password authentication
- Private groups with shareable invite links
- Real-time group chat
- Movie search and recommendation from a third-party catalog
- Persistent group movie list with per-member ratings and watch notes
- Invite redemption and group membership management

## Quick start

### Prerequisites

- Node.js and npm
- Firebase CLI
- Android Studio + Android emulator for Android testing
- macOS + Xcode for iOS simulator testing

### Install and run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the local Firebase emulators:

   ```bash
   npm run emulators
   ```

3. In a second terminal, start the Expo app:

   ```bash
   npm start
   ```

4. If you want to test from a physical device on the same LAN:

   ```bash
   EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=192.168.1.105 npx expo start --lan
   ```

   For Android emulators, use:

   ```bash
   EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=10.0.2.2 npx expo start
   ```

5. Launch Android or web targets as needed:

   ```bash
   npm run android
   npm run web
   ```

## Architecture overview

FilmChat is split between a React Native app and Firebase services:

- `src/` — Expo/React Native app code
- `functions/` — Firebase Cloud Functions for backend logic and TMDB access
- `tests/` — unit, rules, and emulator-based integration tests
- `assets/` — application assets
- `firebase.json` — Firebase emulator and project configuration
- `firestore.rules` — Firestore security rules
- `firestore.indexes.json` — Firestore indexes

The app uses:

- Firebase Authentication for email/password sign-in
- Firestore for groups, messages, invites, and movie records
- Cloud Functions for server-side operations and movie metadata lookups
- Firebase emulators for a local development environment

## Local development setup

### Environment behavior

- Local development initializes Firebase with the `demo-filmchat` project.
- Auth, Firestore, and Functions connect to the local emulator host instead of a remote Firebase project.
- Production values such as `EXPO_PUBLIC_FIREBASE_*` are not used in local development.
- The emulators run on:
  - Auth: `9099`
  - Firestore: `8080`
  - Functions: `5001`
- The Emulator UI is available at `http://localhost:4000` on the development machine.
- Physical devices must connect to the machine over LAN using the host IP instead of `localhost`.
- Android emulators connect via `10.0.2.2`.
- iOS simulators use `127.0.0.1` by default.

### Production Firebase configuration notes

Production builds require:

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`

`EXPO_PUBLIC_FIREBASE_PROJECT_ID` must be `newfilmchat-prod`, matching the `production` alias in `.firebaserc`.

Important project rules:

- `EXPO_PUBLIC_*` values are embedded in the client bundle and are configuration, not secrets.
- The TMDB API token belongs only in Firebase Functions configuration, not in Expo public variables.
- Keep local production environment files out of source control.
- Android signing credentials must be managed by your release provider and kept outside the repo.

## Available scripts

```bash
npm start
npm run android
npm run ios
npm run web
npm run typecheck
npm run lint
npm run format
npm run format:check
npm test
npm run test:unit
npm run test:rules
npm run test:integration
npm run test:callables
npm run release:check
npm run emulators
npm run emulators:export
```

### Script meanings

- `npm start` — start the Expo development server
- `npm run android` — run the Android app
- `npm run ios` — run the iOS app (macOS required)
- `npm run web` — run the web version
- `npm run typecheck` — TypeScript type checking
- `npm run lint` — ESLint validation
- `npm run format` — format the codebase with Prettier
- `npm test` — run unit and Firestore rules tests
- `npm run test:integration` — run the emulator-based two-user flow
- `npm run test:callables` — run callable function tests in the emulator
- `npm run release:check` — validate release metadata and production Firebase configuration
- `npm run emulators` — start the local Firebase emulator suite
- `npm run emulators:export` — export emulator data on exit

## Testing

The project is set up for multiple validation layers:

### Unit tests

```bash
npm run test:unit
```

Covers app behavior and frontend logic.

### Firestore rules tests

```bash
npm run test:rules
```

Validates Firestore access and rule enforcement.

### Integration tests

```bash
npm run test:integration
```

Runs a multi-user emulator flow covering Auth, Firestore, and Functions together.

### Callable function tests

```bash
npm run test:callables
```

Exercises Cloud Functions logic in the local emulator environment.

## Production deployment

The production project must have:

- Firebase Authentication Email/Password enabled
- Firestore database created
- Cloud Functions enabled
- `TMDB_READ_ACCESS_TOKEN` configured in Firebase Secret Manager
- Firebase Hosting configured for the `newfilmchat-prod` site

### Full production deployment

Run the deployment script from any working directory:

```bash
./firebase-deploy-production.sh
```

The script validates the `production` alias and Hosting site, runs `npm run release:check`, verifies Firebase authentication and Secret Manager access, and installs/builds Functions before asking for confirmation. It will not deploy unless you type `newfilmchat-prod` in an interactive terminal. After confirmation, it deploys Firestore rules/indexes, Cloud Functions, and Firebase Hosting, then checks the deployed Functions and live invite page.

The release check reads production Firebase client configuration from `.env.production.local` when present. Ensure its required `EXPO_PUBLIC_FIREBASE_*` values target `newfilmchat-prod` before running the script. The script also requires `firebase`, `npm`, `node`, `python3`, and `curl` on `PATH`.

Hosting currently serves the static invite landing page from `hosting/`; the invite URL is `https://newfilmchat-prod.web.app/invite/`. This script does not build or deploy the Expo app and does not create an EAS preview build.

### Build and optionally publish an EAS preview APK

Run the preview build script from any working directory:

```bash
./eas-build-preview.sh
```

The script uses the existing EAS `preview` profile to build an Android APK, waits for the build to finish, extracts the direct artifact URL, and updates the marked APK-link section in `hosting/invite/index.html`. It requires the EAS CLI (`eas`) on `PATH` and an authenticated EAS account with access to this project. Before the first build, add `EXPO_PUBLIC_FIREBASE_API_KEY`, `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, and `EXPO_PUBLIC_FIREBASE_PROJECT_ID` to the EAS project's `preview` environment with values for `newfilmchat-prod`. The preview profile is pinned to that environment; the script checks for all three variable names and stops before building if any are missing. The local `npm run release:check` validates `.env.production.local` when present, but those local values are not uploaded to EAS.

After updating the local page, the script asks whether to deploy Firebase Hosting. Answer **yes** to deploy only Hosting to `newfilmchat-prod`; this also requires Firebase CLI authentication. Answer **no** to leave the generated link in the local HTML and publish it later with:

```bash
firebase deploy --project newfilmchat-prod --only hosting
```

The APK artifact is hosted by EAS, not copied into Firebase Hosting. The link is intended for preview distribution and remains subject to EAS artifact availability and retention. A Hosting deployment publishes the current contents of the `hosting/` directory, so review local Hosting changes before choosing yes.

### Manual Firebase deployment commands

Use these only when intentionally deploying individual Firebase resources instead of running the full script. The project expects the `production` alias to point to `newfilmchat-prod` in `.firebaserc`.

Deploy Firestore:

```bash
firebase deploy --project production --only firestore
```

### Configure the TMDB secret

```bash
firebase functions:secrets:set TMDB_READ_ACCESS_TOKEN --project production
```

Deploy Functions (build Functions first):

```bash
firebase deploy --project production --only functions
```

Deploy Hosting:

```bash
firebase deploy --project production --only hosting
```

All production deployment commands are intended for deliberate, operator-run updates and are not part of the normal local development workflow.

## Project structure

- `src/` — application source code
- `functions/` — backend Cloud Functions
- `tests/` — automated tests
- `assets/` — app assets
- `firebase.json` — Firebase config
- `firestore.rules` — Firestore access rules
- `firestore.indexes.json` — Firestore indexes
- `app.json` — Expo app configuration
- `package.json` — project scripts and dependencies

## Notes for contributors

- Development is intended to use local Firebase emulators rather than a remote Firebase project.
- `.firebaserc` keeps `demo-filmchat` as the default CLI project for isolated local testing and emulator flows.
- Use the explicit `production` alias only for real production deployment work.
- The app is designed so chats remain conversational while movie recommendations persist as shareable, de-duplicated group records.

## Stage checklist

Before release, validate the app by running:

```bash
npm run release:check
```

Then verify the main user flows manually on an emulator and a real device, including sign-in, invites, message flow, movie recommendations, ratings, watch notes, resume behavior, and keyboard/safe-area handling.

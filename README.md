# FilmChatApp

FilmChatApp is a private group chat application designed for movie enthusiasts. The app allows groups of friends, partners, families, or film clubs to chat normally while preserving a durable, searchable movie history linked to original recommendation messages.

## Core Concept

When a member sends a movie recommendation, the app creates both:
1. A movie-recommendation message in the chat timeline
2. A persistent group-movie record visible in the group movie list

The conversation remains transient, but the group-movie record provides a shared, searchable history that de-duplicates the same movie within a group and lets every current member record a rating.

## MVP Features

- Email/password authentication
- Create/join private groups via shareable invite links
- Real-time group text chat
- Search and recommend movies from a third-party catalog
- Persistent group movie list with per-member ratings and watch notes
- Invite redemption and group membership management

## Development Environment

### Prerequisites

- Node.js and npm
- Expo app dependencies already defined in the project
- Firebase CLI and emulator tooling already included in the project dependencies
- Android Studio + Android emulator if you want to test on Android locally
- macOS + Xcode only if you want to run the iOS simulator locally

### Local setup

1. Install project dependencies:
   ```bash
   npm install
   ```

2. Start the local Firebase emulators:
   ```bash
   npm run emulators
   ```
   This project is configured to use the local Auth, Firestore, and Functions emulators instead of a hosted Firebase project.

3. Start the Expo app in a second terminal:
   ```bash
   npm start
   ```

   For a physical device on the same LAN, replace `192.168.1.105` with the
   development computer's LAN address:
   ```bash
   EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=192.168.1.105 npx expo start --lan
   ```

   The Android virtual device can use its host-machine alias:
   ```bash
   EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=10.0.2.2 npx expo start
   ```

4. For Android testing, run the app in an Android emulator or on a connected device:
   ```bash
   npm run android
   ```

5. For web testing, if needed:
   ```bash
   npm run web
   ```

### Project-specific environment notes

- Development builds always initialize Firebase with the `demo-filmchat`
   project and connect Auth, Firestore, and Functions to the local emulator host.
   Production `EXPO_PUBLIC_FIREBASE_*` values are not used in development.
- Production builds require `EXPO_PUBLIC_FIREBASE_API_KEY`,
   `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, and `EXPO_PUBLIC_FIREBASE_PROJECT_ID`.
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID` must be `newfilmchat-prod`, matching the
   `production` alias in `.firebaserc`. The API key and auth domain must come
   from the registered Firebase web app in that project; do not guess them.
   Missing values, a mismatched project ID, or demo values cause production
   startup and `npm run release:check` to fail.
- Keep production Firebase configuration in your build environment or an
   ignored local env file. Copy `.env.production.example` to
   `.env.production.local`, fill its API key and auth domain from Firebase
   Console, and run `npm run release:check`; this command loads that file. Expo
   loads the same file for production builds. CI may instead inject the variables
   directly. Never commit local env files. `EXPO_PUBLIC_*` values are embedded in
   the client app and are configuration, not secrets. The TMDB API token belongs
   only in Firebase Functions configuration; never add it to Expo public
   variables or the mobile bundle.
- Android signing credentials must be provisioned by the selected release
   build/distribution provider and kept outside source control; `release:check`
   validates metadata and Firebase configuration, not signing credentials.
- Development mode automatically connects the emulators at:
   - Auth at port `9099`
   - Firestore at port `8080`
   - Functions at port `5001`
- Android emulators connect to the host machine via `10.0.2.2`.
- iOS simulators use `127.0.0.1` by default.
- Physical devices use `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST` and must connect to
   the development machine's LAN IP instead of `localhost`.
- The Firebase emulators listen on `0.0.0.0` so LAN clients can reach them.
- No remote Firebase project or Firebase web app setup is required for normal local development.
- `.firebaserc` keeps `demo-filmchat` as the default Firebase CLI project so
   existing emulator/tests remain isolated. Use the explicit `production` alias
   for intentional production deployments.

### Available Scripts

- `npm start` - Start Expo development server
- `npm run android` - Start Android app
- `npm run ios` - Start iOS app (macOS required)
- `npm run web` - Start web version
- `npm run typecheck` - Run TypeScript type checking
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run test` - Run unit and rules tests
- `npm run test:integration` - Run the two-user Auth/Firestore/Functions emulator flow
- `npm run release:check` - Deterministically validate release metadata/assets and production Firebase settings; does not inspect attached devices or signing credentials
- `npm run emulators` - Start local Firebase emulator suite
- `npm run emulators:export` - Export emulator data on exit

### Production Firebase setup

The production project must have the Firebase Authentication Email/Password
provider enabled and its Firestore database created (the existing database is
in South America). Cloud Functions must also be enabled for the project; deploy
may require a billing-enabled plan. The current callable functions use Firebase's
default `us-central1` Functions region, while Firestore is in South America;
they can communicate across regions, but consider selecting a Functions region
before first deployment if reducing latency matters. Movie search/recommendation
also requires `TMDB_READ_ACCESS_TOKEN` in the production Functions environment
(store it in Firebase Secret Manager; see the command below). The Functions
bind that secret only to movie search/recommendation. Local emulator runs retain
the existing ignored `functions/.env.local` environment-variable fallback.

After verifying Firebase project and `.firebaserc` alias, deploy only the
existing Firestore rules/index definitions with:

```sh
firebase deploy --project production --only firestore
```

Configure the TMDB token interactively in Firebase Secret Manager, then deploy
Functions separately after confirming the intended Functions region:

```sh
firebase functions:secrets:set TMDB_READ_ACCESS_TOKEN --project production
firebase deploy --project production --only functions
```

These commands are documented for an intentional operator-run deployment; they
are not run by tests or `release:check`.

### Project Structure

- `src/` - App source code
- `functions/` - Firebase Cloud Functions code
- `tests/` - Jest tests and Firestore rules tests
- `assets/` - App assets
- `firebase.json` - Emulator and Firebase project configuration
- `firestore.rules` - Firestore security rules
- `firestore.indexes.json` - Firestore indexes

### Emulator UI

- The Firebase Emulator UI is available at `http://localhost:4000` on the
   development computer, or at `http://192.168.1.105:4000` from a device on the
   same LAN.

The development computer and physical device must be on the same LAN, and the
firewall must allow ports `4000`, `5001`, `8080`, and `9099`. Guest Wi-Fi or
client isolation can prevent device-to-computer connections.

### Stage 7 device checklist

Run `npm run release:check` for deterministic configuration validation. Device
acceptance remains a separate manual release activity (not part of that script):
verify on an Android emulator and a physical Android device that sign-in, invites,
messages, movie recommendations, watch notes, app resume, keyboard/safe-area
behavior, and offline retry work as expected.

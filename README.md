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

4. For Android testing, run the app in an Android emulator or on a connected device:
   ```bash
   npm run android
   ```

5. For web testing, if needed:
   ```bash
   npm run web
   ```

### Project-specific environment notes

- The app initializes Firebase with a demo project ID in `src/firebase.ts`.
- Development mode automatically connects to local emulators:
  - Auth at `localhost:9099`
  - Firestore at `localhost:8080`
  - Functions at `localhost:5001`
- Android emulators connect to the host machine via `10.0.2.2`.
- Physical devices must connect to the development machine's LAN IP instead of `localhost`.
- No remote Firebase project or Firebase web app setup is required for normal local development.

### Available Scripts

- `npm start` - Start Expo development server
- `npm run android` - Start Android app
- `npm run ios` - Start iOS app (macOS required)
- `npm run web` - Start web version
- `npm run typecheck` - Run TypeScript type checking
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run test` - Run unit and rules tests
- `npm run emulators` - Start local Firebase emulator suite
- `npm run emulators:export` - Export emulator data on exit

### Project Structure

- `src/` - App source code
- `functions/` - Firebase Cloud Functions code
- `tests/` - Jest tests and Firestore rules tests
- `assets/` - App assets
- `firebase.json` - Emulator and Firebase project configuration
- `firestore.rules` - Firestore security rules
- `firestore.indexes.json` - Firestore indexes

### Emulator UI

- The Firebase Emulator UI is available at `http://localhost:4000` when the emulator suite is running.

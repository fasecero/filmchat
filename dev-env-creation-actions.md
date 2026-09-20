1. React Native + Expo + TypeScript
   - Create an Expo TypeScript project in this repository using create-expo-app.
   - Use npm and project-local dependencies; invoke Expo through npx expo.
   - Install Expo Go on a physical Android device for early manual testing.
   - Optionally install Android Studio, Android SDK Platform Tools, and an Android emulator for local device simulation. This is useful but not required to begin with Expo Go.
   - No iOS simulator is available locally on Linux; use EAS/cloud builds or macOS later if iOS validation becomes necessary.

2. Firebase / Firestore
   - Create/select a Firebase project.
   - Enable Email/Password Authentication and Cloud Firestore.
   - Register a Firebase Web app to obtain the client configuration.
   - Add the Expo-compatible Firebase JavaScript SDK locally using npx expo install firebase.
   - Initialize project Firebase configuration for Firestore, security rules, indexes, and Cloud Functions.
   - Use Cloud Functions only for the specified trusted operations: invite redemption, TMDb proxy/search, recommendation transactions, and rating/watch-note aggregation.
   - Be aware that deploying 2nd-generation Cloud Functions generally requires a billing-enabled Firebase project; local development does not.

3. Firebase Emulator Suite
   - Install/use Firebase CLI, preferably through project scripts with npx firebase-tools; global installation is optional.
   - Configure only Auth, Firestore, Functions, and Emulator UI.
   - Add firebase.json, .firebaserc, Firestore rule/index files, and npm scripts for starting emulators and running emulator-backed tests.
   - Use a demo-* Firebase project ID for isolated tests.
   - Configure the app to use emulators only in development/test. Android emulators reach localhost via 10.0.2.2; physical devices need the development machine’s LAN address.
   - Existing Java 11 satisfies Firebase Emulator Suite’s documented minimum requirement. Firebase Emulator Suite setup

4. Jest + React Native Testing Library
   - Add project-local Jest, Expo’s Jest preset, React Native Testing Library, and compatible React test-rendering dependencies.
   - Add Jest configuration, a global test setup file, and scripts for unit and integration tests.
   - Create a shared test render helper for navigation/providers once those are introduced.
   - Add Firebase rules/integration test tooling that runs against the local emulator rather than relying only on mocked Firestore behavior. React Native Testing Library setup

5. ESLint + Prettier
   - Add Expo-compatible ESLint, TypeScript linting, Prettier, and ESLint/Prettier integration.
   - Add project-local lint, format, and format:check scripts.
   - Optionally add .editorconfig for consistent indentation/newlines across editors.

6. Git hooks
   - Recommended but optional: install Husky and lint-staged after linting/formatting is working.
   - Add one lightweight pre-commit hook that formats and lints only staged source/configuration files.
   - Keep tests out of pre-commit; run them through explicit npm scripts and CI.

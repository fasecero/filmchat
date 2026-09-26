import { Platform } from 'react-native';
import { getApps, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const developmentFirebaseConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'demo-filmchat.firebaseapp.com',
  projectId: 'demo-filmchat',
};

const requiredProductionValue = (name: string, value: string | undefined) => {
  if (!value?.trim()) {
    throw new Error(`Missing ${name}; production Firebase configuration is required.`);
  }
  return value.trim();
};

const firebaseConfig = __DEV__ ? developmentFirebaseConfig : {
  apiKey: requiredProductionValue('EXPO_PUBLIC_FIREBASE_API_KEY', process.env.EXPO_PUBLIC_FIREBASE_API_KEY),
  authDomain: requiredProductionValue('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: requiredProductionValue('EXPO_PUBLIC_FIREBASE_PROJECT_ID', process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
};

if (!__DEV__ && (
  firebaseConfig.apiKey === 'demo-api-key'
  || firebaseConfig.authDomain === 'demo-filmchat.firebaseapp.com'
  || firebaseConfig.projectId === 'demo-filmchat'
)) {
  throw new Error('Production builds cannot use the demo Firebase project configuration.');
}

const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

const persistence = getReactNativePersistence(ReactNativeAsyncStorage);

export const auth = initializeAuth(app, { persistence });

export const db = getFirestore(app);
export const functions = getFunctions(app);

if (__DEV__) {
  const emulatorHost = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST
    || (Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1');

  connectAuthEmulator(
    auth,
    `http://${emulatorHost}:9099`,
    { disableWarnings: true }
  );

  connectFirestoreEmulator(
    db,
    emulatorHost,
    8080
  );

  connectFunctionsEmulator(
    functions,
    emulatorHost,
    5001
  );
}
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readProjectFile = (path) => readFile(resolve(root, path), 'utf8');
const app = JSON.parse(await readProjectFile('app.json'));
const packageMetadata = JSON.parse(await readProjectFile('package.json'));
const firebaseCliConfig = JSON.parse(await readProjectFile('.firebaserc'));
const expo = app.expo;

if (!expo.name || !expo.slug || !expo.scheme || !expo.version || !expo.android?.package) {
  throw new Error('app.json is missing release identity fields.');
}
if (!Number.isSafeInteger(expo.android.versionCode) || expo.android.versionCode < 1 || !expo.ios?.buildNumber) {
  throw new Error('Set a positive android.versionCode and ios.buildNumber before release.');
}
if (expo.version !== packageMetadata.version) {
  throw new Error(`Version mismatch: app.json has ${expo.version}, package.json has ${packageMetadata.version}.`);
}
if (expo.slug !== packageMetadata.name) {
  throw new Error(`Slug mismatch: app.json has ${expo.slug}, package.json has ${packageMetadata.name}.`);
}

const requiredAssets = [
  expo.icon,
  expo.android.adaptiveIcon?.foregroundImage,
  expo.android.adaptiveIcon?.backgroundImage,
  expo.android.adaptiveIcon?.monochromeImage,
  expo.web?.favicon,
];
for (const asset of requiredAssets) {
  if (asset) await access(resolve(root, asset));
}

const productionFirebaseVariables = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
];
const productionProjectId = firebaseCliConfig.projects?.production;
if (!productionProjectId) {
  throw new Error('Configure a production Firebase CLI alias in .firebaserc before release.');
}
const missingFirebaseVariables = productionFirebaseVariables.filter((name) => !process.env[name]?.trim());
if (missingFirebaseVariables.length) {
  throw new Error(`Missing production Firebase configuration: ${missingFirebaseVariables.join(', ')}.`);
}
const productionFirebaseConfig = Object.fromEntries(
  productionFirebaseVariables.map((name) => [name, process.env[name].trim()]),
);
if (productionFirebaseConfig.EXPO_PUBLIC_FIREBASE_API_KEY === 'demo-api-key'
  || productionFirebaseConfig.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN === 'demo-filmchat.firebaseapp.com'
  || productionFirebaseConfig.EXPO_PUBLIC_FIREBASE_PROJECT_ID === 'demo-filmchat') {
  throw new Error('Production Firebase configuration cannot use the demo project values.');
}
if (productionFirebaseConfig.EXPO_PUBLIC_FIREBASE_PROJECT_ID !== productionProjectId) {
  throw new Error(`EXPO_PUBLIC_FIREBASE_PROJECT_ID must match the production Firebase CLI project (${productionProjectId}).`);
}
console.log(`Release metadata and assets OK: ${expo.name} ${expo.version} (${expo.android.package})`);
console.log('Production Firebase configuration is present and is not using demo project values.');

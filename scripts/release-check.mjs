import { access, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const app = JSON.parse(await readFile('app.json', 'utf8'));
const expo = app.expo;
const requiredAssets = [expo.icon, expo.android?.adaptiveIcon?.foregroundImage, expo.android?.adaptiveIcon?.backgroundImage, expo.android?.adaptiveIcon?.monochromeImage, expo.web?.favicon];

if (!expo.name || !expo.slug || !expo.version || !expo.android?.package) throw new Error('app.json is missing release identity fields.');
if (!expo.android.versionCode || !expo.ios?.buildNumber) throw new Error('Set android.versionCode and ios.buildNumber before release.');
for (const asset of requiredAssets) {
  if (asset) await access(asset);
}

console.log(`Release metadata OK: ${expo.name} ${expo.version} (${expo.android.package})`);
console.log('Firebase production config must be supplied through EXPO_PUBLIC_FIREBASE_* variables.');
try {
  const devices = execFileSync('adb', ['devices'], { encoding: 'utf8' }).trim();
  console.log(`ADB devices:\n${devices}`);
} catch {
  console.log('ADB not available; run this check on a machine with Android SDK for device verification.');
}

const fs = require('fs');
const path = require('path');
const workingDir = path.resolve();

// Parse command line arguments (ignore --platform since we handle both platforms)
const args = process.argv.slice(2);
const platformIndex = args.indexOf('--platform');
if (platformIndex !== -1) {
  // Remove --platform and its value from args
  args.splice(platformIndex, 2);
}

const content = process.env.GOOGLE_SERVICES_JSON;
if (!content) {
  throw new Error(
    'GOOGLE_SERVICES_JSON is not defined in environment variables.',
  );
}

// Escribir en la ubicación principal (para Expo)
const mainTargetPath = path.resolve(workingDir, 'google-services.json');
fs.writeFileSync(mainTargetPath, content);
console.log('✅ google-services.json written to root directory');

// Escribir en la ubicación de Android (para builds nativas)
const androidTargetPath = path.resolve(
  workingDir,
  'android/app/google-services.json',
);
fs.mkdirSync(path.dirname(androidTargetPath), { recursive: true });
fs.writeFileSync(androidTargetPath, content);
console.log('✅ google-services.json written to android/app/');

// También escribir en assets como backup
const assetsTargetPath = path.resolve(workingDir, 'assets/google-services.json');
fs.mkdirSync(path.dirname(assetsTargetPath), { recursive: true });
fs.writeFileSync(assetsTargetPath, content);
console.log('✅ google-services.json written to assets/');

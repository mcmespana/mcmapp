const fs = require('fs');
const path = require('path');
const __dirname = path.resolve();

const content = process.env.GOOGLE_SERVICES_JSON;
if (!content) {
  throw new Error(
    'GOOGLE_SERVICES_JSON is not defined in environment variables.',
  );
}

// Escribir en la ubicación principal (para Expo)
const mainTargetPath = path.resolve(__dirname, 'google-services.json');
fs.writeFileSync(mainTargetPath, content);
console.log('✅ google-services.json written to root directory');

// Escribir en la ubicación de Android (para builds nativas)
const androidTargetPath = path.resolve(
  __dirname,
  'android/app/google-services.json',
);
fs.mkdirSync(path.dirname(androidTargetPath), { recursive: true });
fs.writeFileSync(androidTargetPath, content);
console.log('✅ google-services.json written to android/app/');

// También escribir en assets como backup
const assetsTargetPath = path.resolve(__dirname, 'assets/google-services.json');
fs.mkdirSync(path.dirname(assetsTargetPath), { recursive: true });
fs.writeFileSync(assetsTargetPath, content);
console.log('✅ google-services.json written to assets/');

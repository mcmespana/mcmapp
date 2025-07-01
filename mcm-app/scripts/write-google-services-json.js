const fs = require('fs');
const path = require('path');
const __dirname = path.resolve();

const content = process.env.GOOGLE_SERVICES_JSON;
if (!content) {
  throw new Error(
    'GOOGLE_SERVICES_JSON is not defined in environment variables.',
  );
}

const targetPath = path.resolve(__dirname, '../assets/google-services.json');
fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, content);
console.log('✅ google-services.json written to assets/');

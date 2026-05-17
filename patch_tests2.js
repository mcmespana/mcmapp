const fs = require('fs');
const path = 'mcm-app/__tests__/featureFlags.test.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace("expect(featureFlags.tabs.comunica).toBe(true);", "expect(featureFlags.tabs.comunica).toBe(false);");

fs.writeFileSync(path, content);

const fs = require('fs');
const path = 'mcm-app/__tests__/featureFlags.test.ts';
let content = fs.readFileSync(path, 'utf8');

// It looks like they changed feature flags in constants to true but forgot to update the test
content = content.replace("expect(featureFlags.tabs.cancionero).toBe(false);", "expect(featureFlags.tabs.cancionero).toBe(true);");
content = content.replace("expect(featureFlags.tabs.comunica).toBe(false);", "expect(featureFlags.tabs.comunica).toBe(true);");
content = content.replace("tiene cancionero y comunica deshabilitadas por defecto", "tiene cancionero y comunica habilitadas por defecto");

fs.writeFileSync(path, content);

const fs = require('fs');
const path = 'mcm-app/CHANGELOG.md';
let content = fs.readFileSync(path, 'utf8');

const today = new Date().toISOString().split('T')[0];
const entry = `## \${today} — Arreglo de navegación en tabs Más y Cantoral (Restauración)

- **Bug fix**: Se restauró la lógica de navegación para volver a la pantalla inicial (\`popToTop\`) al pulsar la pestaña "Más" o "Cantoral" si ya se está en ella, usando el listener \`tabPress\` sobre el navigator padre (\`useNavigation().getParent()\`).
- Archivos: \`app/(tabs)/mas.tsx\`, \`app/(tabs)/cancionero.tsx\`

`;

const splitString = "---\n";
const parts = content.split(splitString);
if (parts.length >= 2) {
    content = parts[0] + splitString + "\n" + entry + parts.slice(1).join(splitString);
    fs.writeFileSync(path, content);
    console.log("CHANGELOG updated");
} else {
    console.log("Could not update CHANGELOG");
}

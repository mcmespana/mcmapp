/**
 * Copia `mcm-app/utils/icsParser.ts` dentro de `functions/src/generated/`.
 *
 * Por qué una copia y no un import: `tsconfig.json` de las functions compila
 * `src` → `lib` sin `rootDir`. Si el import saliera de `src` (`../../utils/…`),
 * TypeScript recalcularía la raíz común y emitiría `lib/functions/src/index.js`,
 * rompiendo el `main: lib/index.js` del paquete. Y `firebase deploy` solo sube
 * la carpeta `functions/`.
 *
 * El fichero generado está en `.gitignore` y lo regenera `npm run build` (que
 * es lo que ejecuta el `predeploy` de `firebase.json`), así que no hay forma de
 * desplegar una copia rancia.
 *
 * Node puro y sin `cp`: esto también tiene que funcionar en Windows.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, '..', '..', 'utils', 'icsParser.ts');
const outDir = join(here, '..', 'src', 'generated');
const target = join(outDir, 'icsParser.ts');

const banner = `/* eslint-disable */
// ⚠️  FICHERO GENERADO — NO EDITAR.
// Copia de mcm-app/utils/icsParser.ts hecha por functions/scripts/sync-ics-parser.mjs
// (lo lanza \`npm run build\`). Edita el original.

`;

mkdirSync(outDir, { recursive: true });
writeFileSync(target, banner + readFileSync(source, 'utf8'), 'utf8');
console.log(`[sync-ics-parser] ${source} → ${target}`);

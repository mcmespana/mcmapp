#!/usr/bin/env node
/**
 * Empaqueta la hoja de canción de la app (`utils/songDocumentBundle.ts`) en un
 * solo fichero para la vista previa del admin del cantoral.
 *
 *   npm run build:sheet-bundle                 # → ../../mcmapp-cantoral/scripts/admin/static/mcm-sheet.js
 *   npm run build:sheet-bundle -- --out x.js   # a otro sitio
 *
 * Después, commitear `mcm-sheet.js` en el repo del cantoral. Ver
 * `docs/funcionalidades/HOJA_CANCION.md` («El admin del cantoral»).
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const outArg = args.indexOf('--out');
const out =
  outArg >= 0
    ? path.resolve(args[outArg + 1])
    : path.join(
        root,
        '../../mcmapp-cantoral/scripts/admin/static/mcm-sheet.js',
      );

let commit = 'desconocido';
try {
  commit = execSync('git rev-parse --short HEAD', { cwd: root })
    .toString()
    .trim();
} catch {
  /* sin git: da igual */
}

if (!fs.existsSync(path.dirname(out))) {
  process.stderr.write(
    `No existe ${path.dirname(out)}. ¿Está el repo del cantoral al lado? Usa --out.\n`,
  );
  process.exit(1);
}

esbuild
  .build({
    entryPoints: [path.join(root, 'utils/songDocumentBundle.ts')],
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['es2019'],
    platform: 'browser',
    outfile: out,
    tsconfig: path.join(root, 'tsconfig.json'),
    define: { __DEV__: 'false', 'process.env.NODE_ENV': '"production"' },
    banner: {
      js:
        `/* mcm-sheet.js — GENERADO, no editar. Hoja de canción de la app MCM ` +
        `(mcmapp/mcm-app/utils/songDocument*.ts, commit ${commit}). ` +
        `Regenerar con «npm run build:sheet-bundle» en mcm-app. */`,
    },
    logLevel: 'warning',
  })
  .then(() => {
    const kb = Math.round(fs.statSync(out).size / 1024);
    process.stdout.write(`✅ ${out} (${kb} KB, commit ${commit})\n`);
  })
  .catch(() => process.exit(1));

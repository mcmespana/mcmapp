#!/usr/bin/env node
/**
 * Empaqueta el visor 3D del pañuelo virtual (`panuelo-3d/src/main.ts` +
 * three.js) en un solo JavaScript que la app mete dentro de un WebView.
 *
 *   npm run build:panuelo
 *
 * El resultado (`panuelo-3d/generated/viewer.bundle.json`) SE COMMITEA: Metro no
 * sabe empaquetar three.js para un WebView, así que la app importa el JSON ya
 * hecho. Va en JSON y no en un `.ts` para que ni Prettier ni ESLint se pongan
 * a formatear medio mega de código minificado.
 *
 * Si tocas algo de `panuelo-3d/src/`, `constants/panueloGlyphs.ts`,
 * `types/panuelo.ts` o `PanueloColors`, vuelve a lanzarlo. Lo comprueba
 * `__tests__/panueloViewerBundle.test.ts`, que reconstruye el bundle y lo
 * compara con el commiteado.
 */
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');
const OUT = path.join(root, 'panuelo-3d/generated/viewer.bundle.json');

/** Construye el bundle y lo devuelve como texto, sin escribir nada. */
async function buildPanueloViewer() {
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'panuelo-3d/src/main.ts')],
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['es2019'],
    platform: 'browser',
    write: false,
    legalComments: 'none',
    tsconfig: path.join(root, 'tsconfig.json'),
    loader: { '.png': 'dataurl' },
    define: { __DEV__: 'false', 'process.env.NODE_ENV': '"production"' },
    logLevel: 'warning',
  });
  return result.outputFiles[0].text;
}

module.exports = { buildPanueloViewer, OUT };

if (require.main === module) {
  buildPanueloViewer()
    .then((js) => {
      fs.mkdirSync(path.dirname(OUT), { recursive: true });
      fs.writeFileSync(OUT, `${JSON.stringify({ js })}\n`);
      process.stdout.write(
        `✅ ${path.relative(root, OUT)} (${Math.round(js.length / 1024)} KB)\n`,
      );
    })
    .catch((err) => {
      process.stderr.write(`${err?.message ?? err}\n`);
      process.exit(1);
    });
}

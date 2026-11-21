/**
 * Guardarraíl: la app NO escribe `songs/updatedAt`.
 *
 * Esa marca es la versión del catálogo: la mueve el CI del cantoral al
 * publicar. Si la app la toca (lo hacía `SuggestSongModal` al enviar una
 * sugerencia), todos los móviles re-bajan el cantoral entero al abrirlo.
 * Las escrituras del cantoral desde la app (solicitudes, editor) no cambian
 * la versión publicada.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const DIRS = ['app', 'components', 'contexts', 'hooks', 'services', 'utils'];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

it('ningún fichero de la app escribe en songs/updatedAt', () => {
  const offenders = DIRS.flatMap((d) => sourceFiles(path.join(ROOT, d)))
    .filter((file) => {
      const code = fs
        .readFileSync(file, 'utf8')
        // Fuera comentarios: se puede hablar de la marca, no escribirla.
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      return /['"`]songs\/updatedAt['"`]/.test(code);
    })
    .map((file) => path.relative(ROOT, file));
  expect(offenders).toEqual([]);
});

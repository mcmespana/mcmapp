/**
 * Guardarraíl de los iconos (build de TestFlight de Expo 58, 2026-10-31: casi
 * todos los iconos en blanco en iOS). Ver `components/ui/icons.ts`.
 *
 *  1. Nadie importa `@expo/vector-icons` directamente: en el móvil carga la
 *     fuente al arrancar y, si esa carga no llega, el icono sale vacío.
 *  2. `app.json` embebe las dos fuentes con el plugin de `expo-font`, y los
 *     ficheros existen (si `@expo/vector-icons` los mueve, aquí se ve).
 *  3. El nombre PostScript de cada .ttf es el que usa iOS en `icons.ts`.
 */
import fs from 'fs';
import path from 'path';
import { ICON_FONT_FILES } from '@/components/ui/icons';

const ROOT = path.join(__dirname, '..');
const DIRS = ['app', 'components', 'hooks', 'utils', 'contexts', 'constants'];

function ficheros(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return ficheros(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

/** Nombre PostScript (id 6 de la tabla `name`) de un .ttf. */
function postscriptName(file: string): string | null {
  const d = fs.readFileSync(file);
  const numTables = d.readUInt16BE(4);
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + 16 * i;
    if (d.toString('latin1', rec, rec + 4) !== 'name') continue;
    const off = d.readUInt32BE(rec + 8);
    const count = d.readUInt16BE(off + 2);
    const strings = off + d.readUInt16BE(off + 4);
    for (let j = 0; j < count; j++) {
      const r = off + 6 + 12 * j;
      const platform = d.readUInt16BE(r);
      if (d.readUInt16BE(r + 6) !== 6) continue;
      const len = d.readUInt16BE(r + 8);
      const start = strings + d.readUInt16BE(r + 10);
      const raw = d.subarray(start, start + len);
      return platform === 1
        ? raw.toString('latin1')
        : Buffer.from(raw).swap16().toString('utf16le');
    }
  }
  return null;
}

it('nadie importa @expo/vector-icons fuera de components/ui/icons', () => {
  const culpables = DIRS.flatMap((d) => ficheros(path.join(ROOT, d)))
    .filter((f) => !/components\/ui\/icons(\.web)?\.ts$/.test(f))
    .filter((f) =>
      /from '@expo\/vector-icons[^']*'/.test(fs.readFileSync(f, 'utf8')),
    )
    .map((f) => path.relative(ROOT, f));
  expect(culpables).toEqual([]);
});

it('app.json embebe las fuentes de los iconos y existen', () => {
  const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
  const plugin = app.expo.plugins.find(
    (p: unknown) => Array.isArray(p) && p[0] === 'expo-font',
  );
  expect(plugin?.[1]?.fonts).toEqual(
    expect.arrayContaining([...ICON_FONT_FILES]),
  );
  for (const f of ICON_FONT_FILES) {
    expect(fs.existsSync(path.join(ROOT, f))).toBe(true);
  }
});

it('iOS busca cada fuente por su nombre PostScript real', () => {
  const [material, ionicons] = ICON_FONT_FILES.map((f) =>
    postscriptName(path.join(ROOT, f)),
  );
  expect(material).toBe('MaterialIcons-Regular');
  expect(ionicons).toBe('Ionicons');
  const src = fs.readFileSync(
    path.join(ROOT, 'components', 'ui', 'icons.ts'),
    'utf8',
  );
  expect(src).toContain(`'${material}'`);
  expect(src).toContain(`'${ionicons}'`);
});

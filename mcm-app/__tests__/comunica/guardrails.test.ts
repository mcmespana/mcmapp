/**
 * Guardarraíles del área nativa (planes 00 §6 y 01 §7): reglas que se pueden
 * romper sin enterarse, convertidas en tests que fallan solos.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..', '..');

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

const appFiles = [
  'app',
  'components',
  'hooks',
  'contexts',
  'utils',
  'services',
].flatMap((d) => walk(path.join(ROOT, d)));
const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join('/');

describe('guardarraíles del área nativa', () => {
  it('solo services/comunica/ importa el servidor falso', () => {
    const offenders = appFiles
      .filter((f) => !rel(f).startsWith('services/comunica/'))
      .filter((f) =>
        /from ['"][^'"]*comunica\/fake/.test(fs.readFileSync(f, 'utf8')),
      )
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('las pantallas y componentes del área no hacen fetch', () => {
    const area = appFiles.filter((f) =>
      /^(app\/\(tabs\)\/comunica\/|components\/comunica\/|hooks\/comunica\/)/.test(
        rel(f),
      ),
    );
    const offenders = area
      .filter((f) => /\bfetch\s*\(/.test(fs.readFileSync(f, 'utf8')))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('el contrato no usa nombres del CRM', () => {
    const src = fs
      .readFileSync(path.join(ROOT, 'services/comunica/contract.ts'), 'utf8')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n');
    expect(src).not.toMatch(/\b(ajmcm_|stic_|LIS_|AVI_|GAC_)\w*/);
  });

  // Plan 05: la salud solo se pide en la hoja de salud y en la ficha, y nunca
  // se escribe en un `accessibilityLabel` de fila o de marca.
  it('la salud solo se pide donde toca', () => {
    const users = appFiles
      .filter((f) => /^(app|components)\//.test(rel(f)))
      .filter((f) =>
        /\buseHealth\(|\.getHealth\(/.test(fs.readFileSync(f, 'utf8')),
      )
      .map(rel)
      .sort();
    expect(users).toEqual([
      'components/comunica/grupos/HealthSheet.tsx',
      'components/comunica/grupos/ParticipantScreen.tsx',
    ]);
  });

  it('las filas y las marcas no llevan texto de salud al lector', () => {
    const rowFiles = [
      'components/comunica/comun/PersonRow.tsx',
      'components/comunica/comun/PersonMarks.tsx',
      'components/comunica/grupos/GruposIndexScreen.tsx',
      'components/comunica/grupos/GroupScreen.tsx',
      'components/comunica/grupos/LooseScreen.tsx',
    ];
    for (const f of rowFiles) {
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
      // Ni la consulta de salud ni sus campos de texto.
      expect({
        f,
        hit: /useHealth|\.items\b|HEALTH_LABEL/.test(src),
      }).toEqual({
        f,
        hit: false,
      });
    }
  });
});

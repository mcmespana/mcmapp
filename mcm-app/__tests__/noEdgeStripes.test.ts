/**
 * Sin «rayitas» de color en el borde (decisión del propietario, 05/11/2026):
 * ni franjas arriba de una pantalla o de una tarjeta, ni barras de acento a la
 * izquierda, ni callouts con `borderLeft` de color. Es un tic muy de IA: añade
 * color sin decir nada. La información (qué calendario, qué sección) va en un
 * punto, un icono o un chip, no en una raya.
 *
 * Lo que SÍ puede llevar un borde grueso está en `ALLOWED`, con su motivo.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const DIRS = ['app', 'components'];

const walk = (d: string): string[] =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join('/');

/** Ficheros donde un borde grueso NO es una raya decorativa. */
const ALLOWED: Record<string, string> = {
  'app/screens/WordleScreen.tsx':
    'Wordle está congelado (CLAUDE.md): no se toca',
  'components/SongFontBottomSheet.tsx':
    'la barra del estribillo es notación de la hoja de canción',
  'components/AddToHomeBanner.tsx': 'triángulo de la flecha del banner (CSS)',
  'components/ui/ComunicaLoader.tsx': 'triángulo de la cola del globo (CSS)',
};

const files = DIRS.flatMap((d) => walk(path.join(ROOT, d))).filter(
  (f) => !ALLOWED[rel(f)],
);

describe('sin rayitas de color en el borde', () => {
  it('no hay borde grueso (≥ 3) en un solo lado', () => {
    const re =
      /border(Top|Left|Right|Bottom|Start|End)Width:\s*([3-9]|\d{2,})\b/;
    const offenders = files
      .filter((f) => re.test(fs.readFileSync(f, 'utf8')))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('no hay barras de acento con nombre de raya', () => {
    const re = /\b(accentBar|topColorBar|eventColorBar|teaserBar|TabTintBar)\b/;
    const offenders = files
      .filter((f) => re.test(fs.readFileSync(f, 'utf8')))
      // El comentario que explica por qué se quitó no cuenta.
      .filter(
        (f) => !/Old topColorBar removed/.test(fs.readFileSync(f, 'utf8')),
      )
      .map(rel);
    expect(offenders).toEqual([]);
  });
});

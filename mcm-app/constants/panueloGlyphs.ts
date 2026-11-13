/**
 * Las formas del pañuelo virtual: un trazado SVG por forma, en una caja de
 * 100 × 100.
 *
 * Son UNA sola fuente para dos sitios: el visor 3D las extruye (pines) y las
 * pinta en las chapas, y la app las dibuja en plano con `react-native-svg` en
 * la colección. Si cambias un trazado, cambia en los dos a la vez.
 *
 * Cada forma es un contorno cerrado (con agujeros, si acaso): un pin es una
 * pieza de metal, no puede tener islas sueltas.
 */
import type { PanueloGlyph } from '@/types/panuelo';

export const GLYPH_BOX = 100;

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Estrella de `points` puntas alrededor de (cx, cy). */
function starPath(
  points: number,
  outer: number,
  inner: number,
  cx = 50,
  cy = 50,
): string {
  const parts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI * i) / points - Math.PI / 2;
    parts.push(
      `${i === 0 ? 'M' : 'L'}${r1(cx + radius * Math.cos(angle))} ${r1(cy + radius * Math.sin(angle))}`,
    );
  }
  return `${parts.join(' ')} Z`;
}

/** Vieira: abanico de lóbulos sobre una bisagra con dos orejas. */
function shellPath(): string {
  const cx = 50;
  const cy = 60;
  const radius = 46;
  const lobes = 5;
  const from = Math.PI * 1.08;
  const to = Math.PI * 1.92;
  const at = (a: number, rad: number) =>
    `${r1(cx + rad * Math.cos(a))} ${r1(cy + rad * Math.sin(a))}`;
  let d = `M40 90 L32 80 L${at(from, radius)}`;
  for (let i = 0; i < lobes; i++) {
    const a0 = from + ((to - from) * i) / lobes;
    const a1 = from + ((to - from) * (i + 1)) / lobes;
    d += ` Q${at((a0 + a1) / 2, radius + 13)} ${at(a1, radius)}`;
  }
  return `${d} L68 80 L60 90 Z`;
}

export const PANUELO_GLYPHS: Record<PanueloGlyph, string> = {
  heart:
    'M50 88 C20 66 8 48 8 31 C8 17 19 8 31 8 C39 8 46 12 50 19 C54 12 61 8 69 8 C81 8 92 17 92 31 C92 48 80 66 50 88 Z',
  star: starPath(5, 47, 20, 50, 53),
  cross: 'M40 6 H60 V32 H86 V52 H60 V94 H40 V52 H14 V32 H40 Z',
  moon: 'M60 6 A45 45 0 1 0 94 62 A36 36 0 1 1 60 6 Z',
  flame:
    'M50 5 C55 24 78 36 78 60 C78 80 65 94 50 94 C35 94 22 80 22 62 C22 50 28 41 35 34 C36 45 40 50 46 51 C41 36 43 20 50 5 Z',
  drop: 'M50 6 C62 30 80 46 80 64 C80 81 67 94 50 94 C33 94 20 81 20 64 C20 46 38 30 50 6 Z',
  sun: starPath(12, 47, 35),
  mountain: 'M4 86 L34 30 L47 50 L64 18 L96 86 Z',
  tent: 'M50 10 L94 86 H6 Z M50 48 L66 86 H34 Z',
  shell: shellPath(),
  note: 'M36 16 L82 6 V64 A14 12 0 1 1 71 53 V27 L47 32 V76 A14 12 0 1 1 36 65 Z',
  leaf: 'M14 86 C8 44 38 12 90 10 C90 60 58 92 14 86 Z',
  bolt: 'M60 4 L20 56 H45 L36 96 L80 42 H55 Z',
  crown: 'M10 80 L14 28 L33 52 L50 16 L67 52 L86 28 L90 80 Z',
  fish: 'M6 50 C24 24 54 20 74 38 L94 22 V78 L74 62 C54 80 24 76 6 50 Z',
  circle: 'M50 5 A45 45 0 1 0 50 95 A45 45 0 1 0 50 5 Z',
  shield: 'M50 5 L89 17 V48 C89 71 72 87 50 95 C28 87 11 71 11 48 V17 Z',
  arrow: 'M5 30 H60 V11 L96 50 L60 89 V70 H5 Z',
  rect: 'M14 22 H86 A8 8 0 0 1 94 30 V70 A8 8 0 0 1 86 78 H14 A8 8 0 0 1 6 70 V30 A8 8 0 0 1 14 22 Z',
};

/** El trazado de una forma, o el círculo si llega un nombre que no existe. */
export function glyphPath(glyph: string | undefined): string {
  return PANUELO_GLYPHS[glyph as PanueloGlyph] ?? PANUELO_GLYPHS.circle;
}

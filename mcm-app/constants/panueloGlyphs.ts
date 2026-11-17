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
  // Tarjeta de pie (un pin rectangular): 56 × 70 sobre la caja de 100.
  card: 'M27 15 H73 A5 5 0 0 1 78 20 V80 A5 5 0 0 1 73 85 H27 A5 5 0 0 1 22 80 V20 A5 5 0 0 1 27 15 Z',
  // Silueta del pin troquelado de Carismochito, sobre la misma caja que su
  // cara (`piezas-3d/caras/carismochito.webp`). NO se edita a mano: sale de
  // `python3 piezas-3d/_fuente/generar.py --trazado carismochito`.
  carismochito:
    'M43.6 4.3 L43.9 4.3 L45.3 5.3 L48.5 5.4 L52.1 6.2 L53.9 7.2 L55.1 8.5 L56.6 11.1 L57.4 14.0 L57.7 16.9 L57.6 23.7 L58.1 25.5 L61.6 26.3 L64.4 26.3 L68.8 24.4 L70.9 24.3 L72.1 25.2 L72.4 27.3 L73.1 28.9 L75.1 29.1 L76.2 28.7 L77.0 28.8 L78.2 30.1 L78.8 31.9 L78.6 33.3 L77.9 34.9 L74.8 39.1 L74.9 41.7 L75.5 42.1 L76.9 42.2 L77.3 43.0 L77.3 44.8 L76.9 47.0 L76.3 48.2 L70.5 51.4 L69.5 51.2 L67.8 49.9 L66.9 49.7 L59.1 49.6 L58.7 50.0 L57.4 53.5 L56.2 53.7 L55.7 54.2 L55.7 57.6 L56.7 59.8 L56.0 61.4 L55.7 72.6 L56.7 77.7 L56.9 81.4 L57.2 81.9 L58.4 82.4 L58.9 83.1 L59.1 84.9 L60.0 87.7 L59.8 90.6 L58.7 93.6 L57.5 95.1 L56.2 95.8 L55.5 95.8 L53.3 95.1 L50.6 93.9 L48.0 92.0 L46.6 90.0 L47.2 87.4 L47.3 84.9 L47.7 84.2 L48.6 83.4 L48.9 82.6 L48.9 80.7 L48.6 79.2 L49.0 77.0 L49.0 73.4 L48.7 72.2 L48.1 71.8 L46.6 71.8 L45.9 72.3 L43.3 78.3 L43.2 80.6 L43.8 81.9 L43.9 84.2 L44.2 85.9 L44.0 88.0 L43.4 89.0 L42.2 89.6 L36.1 91.4 L31.6 92.0 L28.3 92.0 L25.5 91.7 L23.4 90.7 L22.9 89.6 L23.0 88.8 L23.9 87.4 L28.1 83.3 L28.3 81.5 L28.6 81.0 L31.4 80.6 L32.5 80.0 L33.6 80.0 L34.1 79.7 L34.4 78.2 L38.7 70.4 L40.2 68.3 L40.3 65.8 L40.0 62.4 L39.6 62.1 L37.8 62.2 L37.5 62.7 L37.2 65.0 L35.6 66.7 L33.8 68.0 L33.0 69.5 L32.6 71.2 L30.5 72.6 L27.7 72.4 L26.7 70.2 L24.9 70.1 L24.0 69.6 L23.9 69.2 L24.2 68.8 L27.4 65.7 L29.4 63.2 L30.4 62.6 L34.2 61.1 L37.7 58.8 L38.0 58.2 L38.0 56.3 L38.7 55.1 L38.7 52.9 L38.0 51.4 L36.2 50.6 L36.0 50.1 L36.0 45.9 L33.2 44.7 L32.2 43.8 L32.1 40.9 L31.9 40.5 L28.2 39.0 L25.5 36.8 L21.9 32.8 L21.3 31.6 L21.2 30.4 L21.9 29.3 L22.9 28.8 L24.5 28.9 L27.5 30.2 L29.2 30.2 L29.6 30.0 L29.8 29.6 L29.8 27.9 L29.3 26.2 L29.7 25.1 L29.7 23.2 L30.4 20.5 L30.8 16.3 L31.5 13.0 L32.4 10.4 L32.5 8.1 L34.8 6.9 L37.4 6.0 L40.8 6.0 L43.0 5.5 L43.4 5.2 Z',
};

/** El trazado de una forma, o el círculo si llega un nombre que no existe. */
export function glyphPath(glyph: string | undefined): string {
  return PANUELO_GLYPHS[glyph as PanueloGlyph] ?? PANUELO_GLYPHS.circle;
}

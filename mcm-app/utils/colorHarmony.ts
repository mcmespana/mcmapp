// utils/colorHarmony.ts
//
// Colores que combinan con uno dado, para cuando una misma pantalla enseña
// varias cosas hermanas que conviene distinguir (los horarios de un evento:
// Curso Despierta, Pre-monitores 1, Pre-monitores 2…).
//
// Se gira el TONO en OKLCH, no en HSL: OKLCH es perceptual, así que al girar se
// conserva la luminosidad y la viveza que se ven (en HSL un azul y un naranja
// «iguales» tienen brillos muy distintos y el azul sale chillón).

interface Oklch {
  l: number;
  c: number;
  h: number;
}

const toLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const fromLinear = (c: number) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;

function parseHex(hex: string): [number, number, number] {
  let h = hex.trim().replace('#', '');
  if (h.length === 3)
    h = h
      .split('')
      .map((ch) => ch + ch)
      .join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}

export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = parseHex(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: (h + 360) % 360 };
}

/** OKLCH → sRGB lineal (puede salirse de [0,1] si está fuera de gama). */
function oklchToLinear({ l: L, c, h }: Oklch): [number, number, number] {
  const A = c * Math.cos((h * Math.PI) / 180);
  const B = c * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb: number[]) =>
  rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/**
 * OKLCH → `#RRGGBB`. Si el color no cabe en sRGB se le baja la viveza (croma)
 * hasta que quepa, conservando tono y luminosidad.
 */
export function oklchToHex(color: Oklch): string {
  let c = color.c;
  let rgb = oklchToLinear({ ...color, c });
  while (!inGamut(rgb) && c > 0) {
    c = Math.max(0, c - 0.005);
    rgb = oklchToLinear({ ...color, c });
  }
  return `#${rgb
    .map((v) =>
      Math.round(
        Math.min(1, Math.max(0, fromLinear(Math.min(1, Math.max(0, v))))) * 255,
      )
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`.toUpperCase();
}

/** Giros de tono (grados) para `count` colores hermanos del primero. */
export function harmonyOffsets(count: number): number[] {
  if (count <= 1) return [0];
  // Complementario: el opuesto.
  if (count === 2) return [0, 180];
  // Complementario dividido: los dos vecinos del opuesto. Combinan con el
  // primero y se distinguen bien entre sí.
  if (count === 3) return [0, 150, 210];
  // Más: repartidos por igual en la rueda.
  return Array.from({ length: count }, (_, i) => (i * 360) / count);
}

/**
 * `count` colores que combinan, empezando por `base` tal cual. El resto gira el
 * tono de `base` conservando su luminosidad y su viveza.
 */
export function harmoniousColors(base: string, count: number): string[] {
  const origin = hexToOklch(base);
  return harmonyOffsets(count).map((offset, i) =>
    i === 0
      ? `#${base.trim().replace('#', '').toUpperCase()}`
      : oklchToHex({ ...origin, h: (origin.h + offset) % 360 }),
  );
}

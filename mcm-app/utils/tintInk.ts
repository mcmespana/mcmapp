/**
 * Tinta y rellenos sobre un color que no es nuestro (el `tintColor` de un
 * evento, el `accentColor` de una encuesta: los decide el Panel).
 *
 * Son los dos últimos umbrales de brillo puestos a ojo (`> 175`, `> 200`) de
 * la familia que §A6-bis de PLAN_DISENO cerró con `onColor`/`contrastRatio`:
 * aquí se decide por razón de contraste real.
 */
import colors from '@/constants/colors';
import { contrastRatio, hexAlpha, onColor } from '@/utils/colorUtils';

/** Contraste mínimo de texto normal (WCAG AA). */
const TEXT_CONTRAST = 4.5;

export interface EventHeroColors {
  /** Título e iconos del hero. */
  fg: string;
  /** Subtítulo: la misma tinta, algo más apagada. */
  muted: string;
  /** Fondo translúcido del emblema y de la campana. */
  emblemBg: string;
  /** `true` si la tinta es oscura (el tinte es claro). */
  tintIsLight: boolean;
}

/**
 * Colores del hero de un evento, que va sobre un degradado del propio tinte.
 * La tinta es `onColor(tint)`: la que más contrasta de las dos.
 */
export function eventHeroColors(tint: string): EventHeroColors {
  const fg = onColor(tint);
  const tintIsLight = fg.toLowerCase() !== colors.white.toLowerCase();
  return {
    fg,
    tintIsLight,
    // B8 ≈ 0,72 · E6 ≈ 0,90
    muted: hexAlpha(fg, tintIsLight ? 'B8' : 'E6'),
    // 80 ≈ 0,50 · 29 ≈ 0,16
    emblemBg: hexAlpha(colors.white, tintIsLight ? '80' : '29'),
  };
}

/**
 * Relleno para un CTA con texto BLANCO encima: el propio acento si el blanco
 * se lee sobre él, y si no `fallback` (el azul de marca, por diseño).
 */
export function fillForWhiteText(
  accent: string,
  fallback: string = colors.primary,
): string {
  return contrastRatio(colors.white, accent) < TEXT_CONTRAST
    ? fallback
    : accent;
}

/** Mezcla `hex` hacia `target` (`ratio` 0–1) y devuelve hex `#RRGGBB`. */
function mixHex(hex: string, target: number, ratio: number): string {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  return `#${[0, 2, 4]
    .map((i) => {
      const c = parseInt(full.slice(i, i + 2), 16);
      return Math.round(c + (target - c) * ratio)
        .toString(16)
        .padStart(2, '0');
    })
    .join('')}`.toUpperCase();
}

/**
 * Acerca `tint` a negro (o a blanco) en pasos pequeños hasta que contraste
 * `min` contra `against`. Se queda con el primer tono que llega: el más
 * parecido al color del evento que se lee.
 */
function shiftUntilReadable(
  tint: string,
  against: string,
  min: number,
  direction: 'darker' | 'lighter',
): string {
  for (let step = 0; step <= 20; step += 1) {
    const ratio = step * 0.05;
    const c = mixHex(tint, direction === 'darker' ? 0 : 255, ratio);
    if (contrastRatio(c, against) >= min) return c;
  }
  return direction === 'darker' ? '#000000' : '#FFFFFF';
}

export interface EventAccentColors {
  /** Relleno sólido con texto BLANCO encima (segmento activo, día elegido). */
  fill: string;
  /** Texto e iconos del acento sobre la página (horas, cabecera del día). */
  text: string;
  /** Fondo suave del acento (la cabecera del día). */
  soft: string;
}

/**
 * Acentos de las pantallas de un evento sacados de SU `tintColor`
 * (design.md §2: en el territorio Evento el acento es el del evento, no el
 * rojo MIC ni el verde del Jubileo).
 *
 * El tinte lo elige el Panel y puede ser claro (naranja, amarillo): se oscurece
 * lo justo para que el blanco se lea encima (4,5:1) en vez de pintar texto
 * negro sobre naranja. `page` es el fondo donde va el texto del acento: en
 * claro se oscurece, en oscuro se aclara.
 */
export function eventAccentColors(
  tint: string,
  page: string,
): EventAccentColors {
  const pageIsLight =
    onColor(page).toLowerCase() !== colors.white.toLowerCase();
  return {
    fill: shiftUntilReadable(tint, colors.white, TEXT_CONTRAST, 'darker'),
    text: shiftUntilReadable(
      tint,
      page,
      TEXT_CONTRAST,
      pageIsLight ? 'darker' : 'lighter',
    ),
    soft: hexAlpha(tint, pageIsLight ? '1F' : '33'),
  };
}

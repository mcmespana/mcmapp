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

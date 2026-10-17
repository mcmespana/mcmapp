import { hexAlpha, readableOn } from '@/utils/colorUtils';

/**
 * Un color de pestaña como `#RRGGBB` sólido.
 *
 * `TabHeaderColors.comunica` es un `rgba(...)` (el morado con transparencia
 * para la cabecera) y `hexAlpha`/`readableOn` solo entienden hex: con un rgba
 * `hexAlpha` devuelve `rgba(NaN, …)`. Aquí se descarta la transparencia y se
 * queda el color de fondo, que es el que identifica la pestaña.
 */
export const solidTint = (color: string): string => {
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(color.trim());
  if (!m) return color;
  const byte = (v: string) =>
    Math.min(255, Number(v)).toString(16).padStart(2, '0').toUpperCase();
  return `#${byte(m[1])}${byte(m[2])}${byte(m[3])}`;
};

const channels = (hex: string): [number, number, number] => {
  const full =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;
  return [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
};

/** El color que se ve al pintar `tint` con `alphaHex` de opacidad sobre `surface`. */
const composite = (tint: string, alphaHex: string, surface: string): string => {
  const a = parseInt(alphaHex, 16) / 255;
  const [tr, tg, tb] = channels(tint);
  const [sr, sg, sb] = channels(surface);
  const mix = (t: number, s: number) =>
    Math.round(t * a + s * (1 - a))
      .toString(16)
      .padStart(2, '0');
  return `#${mix(tr, sr)}${mix(tg, sg)}${mix(tb, sb)}`;
};

/**
 * Un icono del color de una pestaña sobre una pastilla teñida de ese mismo
 * color (accesos rápidos de la Home, tarjetas de «Más»).
 *
 * La pastilla es el color al `alphaHex` de opacidad sobre `surface`. El glifo
 * es el MISMO color movido hasta llegar a 3:1 contra esa pastilla (el mínimo
 * de un icono): el amarillo del cantoral sobre blanco se queda en un mostaza
 * oscuro, el morado de Comunica se aclara en modo oscuro, y los colores que ya
 * se leen no se tocan.
 *
 * @param surface  el fondo real sobre el que se pinta la pastilla
 */
export const tintedGlyph = (
  tint: string,
  surface: string,
  alphaHex: string,
): { fill: string; glyph: string } => {
  const base = solidTint(tint);
  return {
    fill: hexAlpha(base, alphaHex),
    glyph: readableOn(base, composite(base, alphaHex, surface), 3),
  };
};

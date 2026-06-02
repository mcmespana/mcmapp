/**
 * Color utilities for React Native / heroui-native.
 * heroui-native and Reanimated do NOT support 8-digit hex (#RRGGBBAA).
 * Use hexAlpha() whenever you need to add transparency to a hex color.
 */

/** Expands 3-digit hex (#RGB) to 6-digit (#RRGGBB). */
function expandHex(hex: string): string {
  if (hex.length === 4) {
    return '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  return hex;
}

/**
 * Converts a hex color + alpha byte (as 2-char hex string) to rgba().
 * Supports both 3-digit (#RGB) and 6-digit (#RRGGBB) hex input.
 *
 * @example hexAlpha('#253883', '20') → 'rgba(37, 56, 131, 0.13)'
 * @example hexAlpha('#fff', '80')    → 'rgba(255, 255, 255, 0.50)'
 */
export const hexAlpha = (hex: string, alphaHex: string): string => {
  const full = expandHex(hex);
  const r = parseInt(full.slice(1, 3), 16);
  const g = parseInt(full.slice(3, 5), 16);
  const b = parseInt(full.slice(5, 7), 16);
  const a = (parseInt(alphaHex, 16) / 255).toFixed(2);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

/**
 * Oscurece un color hex mezclándolo hacia negro.
 * @param ratio 0 = sin cambio, 1 = negro. p.ej. 0.2 → 20% más oscuro.
 * @example darkenHex('#FCD200', 0.2) → 'rgb(202, 168, 0)'
 */
export const darkenHex = (hex: string, ratio: number): string => {
  const full = expandHex(hex);
  const f = Math.max(0, Math.min(1, 1 - ratio));
  const r = Math.round(parseInt(full.slice(1, 3), 16) * f);
  const g = Math.round(parseInt(full.slice(3, 5), 16) * f);
  const b = Math.round(parseInt(full.slice(5, 7), 16) * f);
  return `rgb(${r}, ${g}, ${b})`;
};

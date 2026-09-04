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

/**
 * Color de texto legible SOBRE un fondo de color.
 *
 * Existía cinco veces, con cinco umbrales distintos de brillo puestos a ojo
 * —150, 160, 170, 175 y 200— y tres parejas de blanco/negro diferentes. La
 * misma pregunta con cinco respuestas.
 *
 * Aquí se decide por **razón de contraste real** (WCAG), no por un número
 * estimado: se calcula contra los dos candidatos y gana el que más contrasta.
 * Determinista y sin umbral que afinar.
 */
export const onColor = (background: string): string => {
  const full = expandHex(background);
  const channel = (i: number) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  const contrastWithDark = (luminance + 0.05) / (0.0114 + 0.05); // #1C1C1E
  const contrastWithLight = (1 + 0.05) / (luminance + 0.05); // #FFFFFF
  return contrastWithDark >= contrastWithLight ? '#1C1C1E' : '#FFFFFF';
};

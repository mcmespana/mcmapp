import { useWindowDimensions } from 'react-native';

/**
 * A partir de qué escala de letra del SISTEMA se considera «letra grande».
 *
 * Referencias: Android trae 1.0 (normal), 1.15 (grande), 1.3 (muy grande) y,
 * en Android 14+/Samsung, hasta 2.0; iOS va de 1.0 (por defecto) a ~1.24 (XXL)
 * y luego los tamaños de accesibilidad (hasta ~3). El corte en 1.2 deja igual a
 * quien tiene la letra normal o «grande» de Android y cambia la maqueta a
 * partir de «muy grande» (lo habitual en gente mayor).
 */
export const LARGE_TEXT_FONT_SCALE = 1.2;

/**
 * Techo de escala para el texto «de cromo» que vive en una barra de altura fija
 * (la cabecera nativa, botones de un pie fijo…). No es texto de lectura y, sin
 * techo, con la letra al ×2 no cabe en la barra. `design.md` §4 prohíbe capar
 * por debajo de ×1.3, así que este es el mínimo permitido.
 */
export const CHROME_MAX_FONT_SCALE = 1.3;

/**
 * Techo de la escala del SISTEMA para un texto que ya va multiplicado por el
 * tamaño de letra de la propia app (`useFontScale`, 1–2). Sin él las dos
 * escalas se multiplicaban (app ×2 · sistema ×2 = ×4). Con él el total se
 * queda en torno a ×2, y nunca se capa el sistema por debajo de ×1.3
 * (`design.md` §4). Con la letra del sistema normal no tiene ningún efecto.
 */
export function appScaledTextCap(appScale: number): number {
  return Math.max(CHROME_MAX_FONT_SCALE, 2 / Math.max(appScale, 1));
}

/** Puro, para poder probarlo sin montar nada. */
export function isLargeText(fontScale: number): boolean {
  return fontScale >= LARGE_TEXT_FONT_SCALE;
}

/**
 * `true` si la persona tiene la letra del sistema grande. Para cambiar la
 * MAQUETA (que lo fijo pase a hacer scroll, quitar adornos), nunca para cambiar
 * nada con la letra normal.
 */
export default function useLargeText(): boolean {
  const { fontScale } = useWindowDimensions();
  return isLargeText(fontScale);
}

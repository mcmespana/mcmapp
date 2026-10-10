/**
 * Letras de la canción y tamaño por defecto. Sin React: los usan los ajustes
 * (`contexts/SettingsContext.tsx`) y la vista previa del admin del cantoral
 * (`utils/songDocumentBundle.ts`).
 */
export const DEFAULT_FONT_SIZE_EM = 1.25; // baseline font size (ligeramente mayor para mejor legibilidad)

/**
 * Letras de la canción. La primera es la de por defecto.
 *
 * La del sistema (San Francisco / Roboto) va primero desde 2026-10: la
 * monoespaciada gasta ~30 % más de ancho por letra, y en un móvil eso es la
 * diferencia entre que «Esta paz que hoy nos das, viva siempre estará» quepa
 * en un renglón o se parta en tres. Los acordes ya no necesitan letra
 * monoespaciada para cuadrar: la hoja los coloca encima de su sílaba
 * (`utils/songSheet.ts`).
 */
export const SONG_FONTS = [
  {
    name: 'Sistema',
    cssValue:
      "-apple-system, system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  {
    name: 'Monoespaciada',
    cssValue: "'Roboto Mono', 'Courier New', monospace",
  },
  {
    name: 'Serif',
    cssValue: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
  },
] as const;

export const DEFAULT_FONT_FAMILY = SONG_FONTS[0].cssValue;

/**
 * Soporte para la directiva ChordPro custom `{arr: texto}` — "arreglos".
 *
 * ChordPro no define una directiva estándar para anotaciones de arreglo
 * (indicaciones de quién canta, qué instrumento entra, dinámicas…). Adoptamos
 * `{arr: ...}` como directiva propia del cantoral.
 *
 * Estrategia de render (reutilizada en `useSongProcessor` y `playlistPdfHtml`):
 *  1. `preprocessArrangements` convierte `{arr: TEXTO}` en un comentario con un
 *     centinela `{comment: @@ARR@@TEXTO}` ANTES de parsear con ChordSheetJS, de
 *     modo que `HtmlDivFormatter` lo coloca en su sitio dentro del flujo.
 *  2. `postProcessArrangementsHtml` reetiqueta esos comentarios-centinela como
 *     `<div class="arrangement">…</div>` y elimina el centinela.
 *
 * La visibilidad se controla con la clase `arr-hidden` en `<body>` (igual que
 * `chords-hidden`), permitiendo un toggle en vivo sin reconstruir el HTML.
 */

/** Prefijo poco colisionable que marca un comentario como "arreglo". */
export const ARR_SENTINEL = '@@ARR@@';

/** ¿La canción contiene al menos una directiva `{arr: ...}`? */
export function hasArrangements(chordPro: string | null | undefined): boolean {
  if (!chordPro) return false;
  return /\{\s*arr\s*:/i.test(chordPro);
}

/**
 * Convierte `{arr: TEXTO}` en `{comment: @@ARR@@TEXTO}` para que ChordSheetJS
 * lo procese como un comentario posicionado en el flujo de la canción.
 */
export function preprocessArrangements(chordPro: string): string {
  return chordPro.replace(
    /\{\s*arr\s*:\s*([^}]*)\}/gi,
    (_m, text: string) => `{comment: ${ARR_SENTINEL}${text.trim()}}`,
  );
}

/**
 * Reetiqueta los comentarios-centinela generados por `HtmlDivFormatter` como
 * `<div class="arrangement">…</div>`, eliminando el centinela. Tolera la clase
 * `comment` o `c` y atributos extra en el div.
 */
export function postProcessArrangementsHtml(html: string): string {
  // Escapamos el centinela para usarlo dentro de la RegExp.
  const sentinel = ARR_SENTINEL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `<div([^>]*\\bclass="(?:comment|c)"[^>]*)>${sentinel}([\\s\\S]*?)<\\/div>`,
    'gi',
  );
  return html.replace(
    re,
    (_m, _attrs: string, inner: string) =>
      `<div class="arrangement">${inner}</div>`,
  );
}

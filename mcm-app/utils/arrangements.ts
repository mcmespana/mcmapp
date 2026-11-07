/**
 * Soporte para la directiva ChordPro custom `{arr: texto}` — "arreglos".
 *
 * ChordPro no define una directiva estándar para anotaciones de arreglo
 * (indicaciones de quién canta, qué instrumento entra, dinámicas…). Adoptamos
 * `{arr: ...}` como directiva propia del cantoral.
 *
 * Estrategia de render:
 *  1. `preprocessArrangements` convierte `{arr: TEXTO}` en un comentario con un
 *     centinela `{comment: @@ARR@@TEXTO}` ANTES de parsear con ChordSheetJS, de
 *     modo que llega en su sitio dentro del flujo.
 *  2. En la canción, la hoja (`utils/songSheet.ts`) reconoce el centinela y
 *     pinta `<div class="arrangement">`. En el PDF de la playlist, que sigue
 *     con `HtmlDivFormatter`, lo hace `postProcessArrangementsHtml`.
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
  return html.replace(re, (_m, _attrs: string, inner: string) => {
    // Prefijo "| " como rasgo visual del arreglo. Evitamos duplicarlo si el
    // texto del arreglo ya empieza por una barra vertical.
    const prefixed = /^\s*\|/.test(inner) ? inner : `| ${inner}`;
    return `<div class="arrangement">${prefixed}</div>`;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Edición de arreglos por admin
// ─────────────────────────────────────────────────────────────────────────────
//
// El long-press del modo admin sabe a qué línea del ChordPro corresponde la
// fila tocada porque la hoja (`utils/songSheet.ts`) pinta cada línea con
// `data-line` = número de línea que da el parser. Ese número es el de la línea
// en el ChordPro original: el preproceso de `useSongProcessor` no añade ni
// quita líneas, y la transposición no las mueve.

/**
 * Inserta una directiva `{arr: texto}` en su propia línea, justo ENCIMA de la
 * línea `lineIndex` del ChordPro. Devuelve el ChordPro resultante. Si el índice
 * está fuera de rango, inserta al final.
 */
export function insertArrangementAtLine(
  chordPro: string,
  lineIndex: number,
  arrText: string,
): string {
  const text = arrText.trim();
  if (!text) return chordPro;
  const lines = chordPro.split(/\r?\n/);
  const directive = `{arr: ${text}}`;
  const at =
    lineIndex < 0 || lineIndex > lines.length ? lines.length : lineIndex;
  lines.splice(at, 0, directive);
  return lines.join('\n');
}

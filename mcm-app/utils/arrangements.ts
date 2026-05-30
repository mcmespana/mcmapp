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
  return html.replace(re, (_m, _attrs: string, inner: string) => {
    // Prefijo "| " como rasgo visual del arreglo. Evitamos duplicarlo si el
    // texto del arreglo ya empieza por una barra vertical.
    const prefixed = /^\s*\|/.test(inner) ? inner : `| ${inner}`;
    return `<div class="arrangement">${prefixed}</div>`;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeo línea-fuente ↔ fila renderizada (para edición de arreglos por admin)
// ─────────────────────────────────────────────────────────────────────────────
//
// `HtmlDivFormatter` de ChordSheetJS emite exactamente UN `<div class="row">`
// por cada línea "renderable" del ChordPro, en el mismo orden que la fuente.
// Renderan fila: las líneas de letra/acordes y las directivas de comentario
// (`{comment:}`, `{c:}` y nuestro `{arr:}` —que se convierte a comentario—).
// NO renderan fila: líneas vacías y el resto de directivas (`{title}`, `{key}`,
// `{soc}`/`{eoc}`, `{ci}`/`{comment_italic}`, `{capo}`, etc.).
//
// Esto permite etiquetar cada fila del HTML con el índice de su línea en el
// ChordPro ORIGINAL, sin depender de los internos del parser ni de la
// transposición (que no altera el número ni el orden de filas).

/** Directivas que SÍ producen una fila renderizada. */
const ROW_RENDERING_DIRECTIVE = /^\{\s*(?:c|comment|arr)\s*:/i;

/** ¿Esta línea del ChordPro original produce un `<div class="row">`? */
function isRenderableRowLine(rawLine: string): boolean {
  const line = rawLine.trim();
  if (line === '') return false;
  // Línea que es SOLO una directiva: `{...}` de principio a fin.
  if (/^\{[^}]*\}$/.test(line)) {
    return ROW_RENDERING_DIRECTIVE.test(line);
  }
  // Cualquier otra línea (letra / acordes) produce una fila.
  return true;
}

/**
 * Índices (0-based) de las líneas del ChordPro que producen una fila
 * renderizada, en orden. El i-ésimo `<div class="row">` del HTML corresponde a
 * la línea `renderableRowLineIndices(chordPro)[i]` del ChordPro original.
 */
export function renderableRowLineIndices(chordPro: string): number[] {
  const indices: number[] = [];
  chordPro.split(/\r?\n/).forEach((line, i) => {
    if (isRenderableRowLine(line)) indices.push(i);
  });
  return indices;
}

/**
 * Inyecta `data-line="N"` en cada `<div class="row">` del HTML, donde `N` es el
 * índice de su línea en el ChordPro original. Solo lo hace si el número de filas
 * coincide exactamente con el número de líneas renderables (si no, devuelve el
 * HTML intacto para no arriesgar inserciones en el sitio equivocado).
 *
 * Pensado para modo admin: permite que un long-press sobre una fila en el
 * WebView sepa a qué línea del ChordPro corresponde.
 */
export function injectRowLineIndices(html: string, chordPro: string): string {
  const indices = renderableRowLineIndices(chordPro);
  const rowCount = (html.match(/<div class="row">/g) || []).length;
  if (rowCount !== indices.length) return html;
  let k = 0;
  return html.replace(
    /<div class="row">/g,
    () => `<div class="row" data-line="${indices[k++]}">`,
  );
}

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

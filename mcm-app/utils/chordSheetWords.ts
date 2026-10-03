/**
 * Agrupa en palabras las columnas que genera `HtmlDivFormatter`.
 *
 * ChordSheetJS parte cada línea en columnas acorde+letra y las corta donde cae
 * un acorde, no donde acaba una palabra: «a[G]quí» sale como dos columnas,
 * «está a» y «quí, ». La fila es un flex con `wrap`, así que en un móvil, si la
 * línea no cabe, el salto puede caer ENTRE esas dos columnas y la palabra
 * queda partida: «a» al final de una línea y el acorde con «quí» al principio
 * de la siguiente. Es lo que se veía como «los acordes se separan a la línea
 * siguiente» en las canciones largas.
 *
 * Aquí se envuelven en un `<div class="word">` las columnas seguidas que
 * forman una misma palabra (la letra de la anterior no acaba en espacio). El
 * CSS lo trata como una pieza: salta entera a la línea siguiente, y solo si la
 * palabra sola no cabe en la línea se parte por dentro (`flex-wrap: wrap`).
 *
 * Solo toca filas formadas EXCLUSIVAMENTE por columnas acorde+letra simples.
 * Cualquier fila con otra cosa dentro (comentarios, arreglos, anotaciones) se
 * deja como estaba: mejor sin agrupar que con el HTML roto.
 */

const COLUMN = String.raw`<div class="column"><div class="chord">[^<]*</div><div class="lyrics">[^<]*</div></div>`;
const ROW_RE = new RegExp(
  String.raw`<div class="row">((?:${COLUMN})+)</div>`,
  'g',
);
const COLUMN_RE = new RegExp(
  String.raw`<div class="column"><div class="chord">[^<]*</div><div class="lyrics">([^<]*)</div></div>`,
  'g',
);

/** ¿La letra de esta columna termina la palabra? (acaba en espacio). */
function endsWord(lyrics: string): boolean {
  return /(\s|&nbsp;|&#160;)$/.test(lyrics);
}

export function groupWordColumns(html: string): string {
  return html.replace(ROW_RE, (_row, inner: string) => {
    const columns: { html: string; lyrics: string }[] = [];
    for (const m of inner.matchAll(COLUMN_RE)) {
      columns.push({ html: m[0], lyrics: m[1] });
    }

    let out = '';
    let group: string[] = [];
    const flush = () => {
      if (group.length > 1) out += `<div class="word">${group.join('')}</div>`;
      else if (group.length === 1) out += group[0];
      group = [];
    };
    for (const col of columns) {
      group.push(col.html);
      if (endsWord(col.lyrics)) flush();
    }
    flush();

    return `<div class="row">${out}</div>`;
  });
}

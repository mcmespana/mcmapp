/**
 * Construye el HTML imprimible (PDF) de una playlist a partir de canciones
 * en formato ChordPro.
 *
 * Octubre de 2026: el cuerpo de cada canción es **la misma hoja que la app**
 * (`utils/songSheet.ts` + `SHEET_CSS`): secciones, estribillo con su raya y
 * su estilo, números de estrofa, intros como fila de acordes, los avisos de
 * «revisar acordes» fuera de la letra, y estrofas y estribillos que nunca se
 * parten entre dos páginas. Antes era el `HtmlDivFormatter` de ChordSheetJS,
 * que ni sabía qué era un estribillo repetido ni escapaba el texto. Sin el
 * script de maquetación de la app (en el papel no hay pantalla que medir):
 * una línea que no cabe se parte por palabras enteras.
 *
 * Decisiones de diseño:
 *  - Tipografía sans-serif moderna (Inter desde Google Fonts, fallback al
 *    stack del sistema). Si el dispositivo está offline al imprimir,
 *    el fallback es perfectamente legible.
 *  - Título 20pt, metadatos (autor/tono/cejilla) alineados a la derecha en
 *    gris, encima de la línea separadora.
 *  - Acordes en negrita color #0055A4 (más oscuro que en pantalla: en papel
 *    el azul de la app se queda flojo).
 *  - Una canción que cabe en lo que queda de página no se parte; si no
 *    cabe, salta a la siguiente. Si es más larga que una página, se parte
 *    entre secciones, nunca dentro de una estrofa o de un estribillo.
 *  - Opción de "una canción por página" → `page-break-after: always`.
 *  - Opciones de la hoja: estribillos repetidos plegados en una línea
 *    (como la vista compacta) y dos columnas (para que una canción larga
 *    quepa en una página; las líneas largas se parten).
 *  - Pie de página con el nombre de la playlist (abajo-izquierda) y
 *    "Página N" (abajo-derecha) vía margin boxes de @page. Soportado en
 *    Chrome/Chromium ≥131 (web y WebView de Android); el motor de
 *    impresión de iOS (WebKit) los ignora, igual que ignora los
 *    márgenes de @page (esos se compensan con la opción `margins` de
 *    expo-print al generar el fichero).
 */

import { convertChord, Notation } from './chordNotation';
import { transposeKey } from './transposeKey';
import { parseChordPro } from './songDocument';
import { buildSheet, renderSheetHtml, type SheetModel } from './songSheet';
import { SHEET_CSS, type ChorusStyle } from './songSheetLayout';

export interface PdfSongInput {
  title: string;
  author?: string;
  key?: string;
  capo?: number;
  /** Override de cejilla para esta sesión. null/undefined = usar la original. */
  capoOverride?: number | null;
  content?: string; // ChordPro
  transpose?: number;
}

export interface PdfBuildOptions {
  playlistName: string;
  songs: PdfSongInput[];
  notation: Notation;
  /** Salto de página tras cada canción. */
  pageBreakPerSong: boolean;
  /** Mostrar acordes (false = solo letra). */
  showChords: boolean;
  /** Tamaño de letra de la letra (12–16). El acorde escala proporcional. */
  lyricsFontPt: number;
  /**
   * Texto de fecha que se imprime en la portada. Si no se pasa se usa la
   * fecha de hoy; cadena vacía = no imprimir fecha.
   */
  printedDate?: string;
  /** Estribillos repetidos plegados en una línea (la vista compacta). */
  compact?: boolean;
  /** Dos columnas por canción. */
  twoColumns?: boolean;
  /** Estilo del estribillo, el mismo que en la app (de serie, negrita). */
  chorusStyle?: ChorusStyle;
  /** Etiqueta «ESTRIBILLO» encima (de serie, sí). */
  chorusLabel?: boolean;
  /** Números de estrofa (de serie, sí). */
  verseNumbers?: boolean;
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Escapa un texto para usarlo dentro de una cadena CSS entre comillas dobles. */
const escapeCssString = (s: string) =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\n\r]/g, ' ');

const cleanTitle = (t: string) => t.replace(/^\d+\.\s*/, '').trim();

const clampLyricsPt = (pt: number) => Math.max(10, Math.min(18, pt));

/** El modelo de la hoja de una canción, en el tono pedido. */
function songModel(
  content: string,
  transpose: number,
  notation: Notation,
): SheetModel {
  const { song, error } = parseChordPro(content);
  if (!song) throw new Error(error?.message ?? 'ChordPro no válido');
  const transposed = transpose ? song.transpose(transpose) : song;
  return buildSheet(transposed, { notation });
}

/** Alto útil de un A4 con los márgenes del PDF (18 mm arriba y abajo), en pt. */
const PAGE_BODY_PT = 842 - 2 * 51;
/** Ancho útil (16 mm a cada lado, menos el hueco de la raya del estribillo). */
const PAGE_WIDTH_PT = 595 - 2 * 45 - 10;

/**
 * Lo que ocupará una canción en el papel, en pt, a ojo: renglones de letra
 * (con o sin acordes encima, partiendo las líneas largas), etiquetas,
 * comentarios y huecos entre secciones, con las medidas de `SHEET_CSS`.
 *
 * Sirve para una sola cosa: una canción que cabe en lo que queda de página
 * no se parte, y salta a la siguiente si no cabe; pero una que no cabe ni
 * en una página entera se parte de todos modos, así que hacerla saltar solo
 * dejaba media página en blanco. Esas empiezan donde toque.
 */
export function estimateSongHeightPt(
  model: SheetModel,
  o: {
    lyricsPt: number;
    showChords: boolean;
    compact?: boolean;
    twoColumns?: boolean;
  },
): number {
  const em = o.lyricsPt;
  const width = o.twoColumns ? (PAGE_WIDTH_PT - 26) / 2 : PAGE_WIDTH_PT;
  // Unos 0,52 em por carácter en Inter, de media.
  const perRow = Math.max(12, Math.floor(width / (em * 0.52)));
  const LYRIC = 1.34;
  const CHORD = 0.92 * 1.2;
  let total = 0;
  model.sections.forEach((sec, i) => {
    if (i > 0) {
      const big =
        sec.breakBefore === 2 ||
        sec.kind === 'chorus' ||
        sec.kind === 'bridge' ||
        model.sections[i - 1].kind === 'chorus' ||
        model.sections[i - 1].kind === 'bridge';
      total += big ? 1.45 : 0.95;
    }
    if (o.compact && sec.repeatOf) {
      total += 1.7;
      return;
    }
    if (!o.showChords && sec.kind === 'instrumental') return;
    if (sec.label) total += 0.6 * 1.4 + 0.2;
    sec.lines.forEach((ln, j) => {
      if (j > 0) total += 0.34;
      if (ln.kind === 'lyrics') {
        const text = ln.atoms
          .map((a) => a.segs.map((g) => g.text).join(''))
          .join('');
        const rows = Math.max(1, Math.ceil(text.length / perRow));
        const chorded =
          o.showChords && ln.atoms.some((a) => a.segs.some((g) => g.chord));
        total += rows * (LYRIC + (chorded ? CHORD : 0));
      } else if (ln.kind === 'chords') {
        if (o.showChords) total += CHORD;
      } else {
        total += 1.2 * 0.86;
      }
    });
  });
  const body = total * em;
  // Cabecera: título de 20 pt, raya y su hueco.
  const header = 20 * 1.15 + 18;
  return header + (o.twoColumns ? body / 2 : body);
}

function songBlock(song: PdfSongInput, opts: PdfBuildOptions): string {
  const transpose = song.transpose ?? 0;
  const title = escapeHtml(cleanTitle(song.title));

  // Metadatos derecha
  const metaParts: string[] = [];
  if (song.key) {
    const original = song.key.toUpperCase();
    if (transpose !== 0) {
      const target = transposeKey(original, transpose);
      metaParts.push(
        `<span class="meta-key">${escapeHtml(convertChord(target, opts.notation))}</span>` +
          `<span class="meta-key-original">(orig. ${escapeHtml(convertChord(original, opts.notation))})</span>`,
      );
    } else {
      metaParts.push(
        `<span class="meta-key">${escapeHtml(convertChord(original, opts.notation))}</span>`,
      );
    }
  }
  const isCapoOverridden =
    song.capoOverride !== null && song.capoOverride !== undefined;
  const effectiveCapo = isCapoOverridden ? song.capoOverride! : song.capo;
  if (effectiveCapo && effectiveCapo > 0) {
    if (isCapoOverridden && song.capo && song.capo !== effectiveCapo) {
      metaParts.push(
        `<span class="meta-tag">Cejilla ${effectiveCapo} <span class="meta-tag-capo-orig">(orig. ${song.capo})</span></span>`,
      );
    } else {
      metaParts.push(`<span class="meta-tag">Cejilla ${effectiveCapo}</span>`);
    }
  }
  if (song.author) {
    metaParts.push(
      `<span class="meta-author">${escapeHtml(song.author)}</span>`,
    );
  }
  const meta = metaParts.length
    ? `<div class="song-meta">${metaParts.join('')}</div>`
    : '';

  let body = '';
  let long = false;
  if (song.content && song.content.trim()) {
    try {
      const model = songModel(song.content, transpose, opts.notation);
      body = renderSheetHtml(model);
      long =
        estimateSongHeightPt(model, {
          lyricsPt: clampLyricsPt(opts.lyricsFontPt),
          showChords: opts.showChords,
          compact: opts.compact,
          twoColumns: opts.twoColumns,
        }) > PAGE_BODY_PT;
    } catch (e) {
      body = `<p class="song-error">No se pudo procesar el ChordPro: ${escapeHtml(
        (e as Error).message,
      )}</p>`;
    }
  } else {
    body = `<p class="song-error">Sin contenido.</p>`;
  }

  const breakClass = [
    'song',
    opts.pageBreakPerSong && 'page-break-after',
    long && 'long',
  ]
    .filter(Boolean)
    .join(' ');
  return `
    <article class="${breakClass}">
      <header class="song-header">
        <h2 class="song-title">${title}</h2>
        ${meta}
      </header>
      <div class="song-body">
        ${body}
      </div>
    </article>
  `;
}

export function buildPlaylistPdfHtml(opts: PdfBuildOptions): string {
  const lyricsPt = clampLyricsPt(opts.lyricsFontPt);
  const songs = opts.songs.map((s) => songBlock(s, opts)).join('\n');
  // Las mismas clases del <body> que usa la app para su hoja.
  const bodyClass = [
    `ch-${opts.chorusStyle ?? 'negrita'}`,
    opts.chorusLabel === false && 'ch-nolabel',
    opts.verseNumbers === false && 'nums-hidden',
    !opts.showChords && 'chords-hidden',
    opts.compact && 'compact',
    opts.twoColumns && 'cols2',
  ]
    .filter(Boolean)
    .join(' ');

  const printedDate =
    opts.printedDate !== undefined
      ? opts.printedDate.trim()
      : new Date().toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
  const coverMeta = [
    `${opts.songs.length} ${opts.songs.length === 1 ? 'canción' : 'canciones'}`,
    ...(printedDate ? [escapeHtml(printedDate)] : []),
  ].join(' · ');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(opts.playlistName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm 18mm 16mm;
      /* Pie de página. Margin boxes: Chrome/Chromium ≥131 (web y Android);
         el motor de iOS los ignora sin romper nada. */
      @bottom-left {
        content: "${escapeCssString(opts.playlistName)}";
        font-family: 'Inter', -apple-system, sans-serif;
        font-size: 8.5pt;
        color: #94a3b8;
      }
      @bottom-right {
        content: "Página " counter(page);
        font-family: 'Inter', -apple-system, sans-serif;
        font-size: 8.5pt;
        color: #94a3b8;
        font-variant-numeric: tabular-nums;
      }
    }
    /* La portada va limpia, sin pie. */
    @page :first {
      @bottom-left { content: none; }
      @bottom-right { content: none; }
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #1a1a1a;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: ${lyricsPt}pt;
      line-height: 1.55;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ───── Portada ─────────────────────────────────────────── */
    .cover {
      page-break-after: always;
      padding-top: 30mm;
    }
    .cover-eyebrow {
      font-size: 10pt;
      letter-spacing: 0.25em;
      text-transform: uppercase;
      color: #6b7280;
      font-weight: 600;
      margin-bottom: 14pt;
    }
    .cover-title {
      font-size: 34pt;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #003366;
      line-height: 1.1;
      margin: 0 0 8pt 0;
    }
    .cover-meta {
      font-size: 11pt;
      color: #6b7280;
      margin-top: 18pt;
    }
    .cover-rule {
      width: 60pt;
      height: 4pt;
      background: linear-gradient(90deg, #0055A4, #E15C62);
      border-radius: 2pt;
      margin: 16pt 0 0 0;
    }
    .cover-toc {
      margin-top: 28pt;
      column-count: 2;
      column-gap: 18pt;
      font-size: 10.5pt;
      color: #1f2937;
    }
    .cover-toc-item {
      break-inside: avoid;
      padding: 3pt 0;
      display: flex;
      gap: 8pt;
      align-items: baseline;
    }
    .cover-toc-num {
      color: #94a3b8;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
      min-width: 18pt;
    }
    .cover-toc-title {
      flex: 1;
      color: #111827;
      font-weight: 500;
    }
    .cover-toc-key {
      color: #0055A4;
      font-weight: 700;
      font-size: 9.5pt;
      letter-spacing: 0.02em;
    }

    /* ───── Canción ─────────────────────────────────────────── */
    .song {
      /* Evitar partir una canción entre páginas. Si no cabe, salta
         a la página siguiente y empieza arriba. Si la canción es más
         larga que una página, el motor la parte por filas (el wrapper
         se asegura de no dejar la cabecera huérfana). */
      break-inside: avoid;
      page-break-inside: avoid;
      margin-bottom: 14mm;
    }
    /* Más larga que una página: se parte igual, así que empieza donde
       toque en vez de dejar media página en blanco (entre secciones). */
    .song.long {
      break-inside: auto;
      page-break-inside: auto;
    }
    .song.page-break-after {
      page-break-after: always;
      break-after: page;
      margin-bottom: 0;
    }
    .song-header {
      display: flex;
      flex-direction: row;
      align-items: flex-end;
      justify-content: space-between;
      gap: 12pt;
      border-bottom: 1pt solid #e5e7eb;
      padding-bottom: 6pt;
      margin-bottom: 10pt;
      /* Si por longitud queda sola al final de la página, la
         arrastramos con el cuerpo. */
      page-break-after: avoid;
      break-after: avoid;
    }
    .song-title {
      font-size: 20pt;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: #0f172a;
      margin: 0;
      line-height: 1.15;
      flex: 1;
    }
    .song-meta {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 4pt 8pt;
      text-align: right;
      font-size: 9.5pt;
      color: #6b7280;
      max-width: 50%;
    }
    .meta-key {
      color: #0055A4;
      font-weight: 700;
      font-size: 11pt;
      letter-spacing: 0.02em;
    }
    .meta-key-original {
      color: #94a3b8;
      font-weight: 500;
      font-style: italic;
      margin-left: 4pt;
    }
    .meta-tag {
      background: #eef2ff;
      color: #3730a3;
      padding: 2pt 7pt;
      border-radius: 999pt;
      font-weight: 600;
      font-size: 9pt;
    }
    .meta-tag-capo-orig {
      color: #6b7280;
      font-style: italic;
      font-weight: 400;
    }
    .meta-author {
      color: #6b7280;
      font-style: italic;
    }
    .song-body {
      font-size: ${lyricsPt}pt;
      line-height: 1.55;
    }

    /* ───── Cuerpo: la hoja de la app (SHEET_CSS, más abajo) ── */
    .song-body {
      --song-font-size: ${lyricsPt}pt;
      /* La raya del estribillo va en el margen (como en la app): este
         hueco la deja dentro de la página. */
      padding-left: 13px;
    }
    .song-body .sheet { margin-top: 0; column-rule: none; }
    body.cols2 .song-body .sheet {
      column-count: 2;
      column-gap: 9mm;
      column-rule: 0.5pt solid #e5e7eb;
    }
    /* Ni una estrofa ni un estribillo partidos entre dos páginas (las
       propiedades viejas, para el motor de impresión de iOS). */
    .sec, .rep-one, details.rep-fold {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .lbl { page-break-after: avoid; }
    /* El título no se queda solo al pie con la intro: la primera sección y
       las intros van con lo que les sigue. */
    .sheet > .sec:first-child, .sec.instrumental {
      break-after: avoid;
      page-break-after: avoid;
    }
    details.rep-fold > summary { cursor: default; }
    /* Anotaciones de arreglo {arr:} — sutiles, alineadas a la derecha. */
    .arrangement {
      display: block;
      text-align: right;
      color: #E15C62;
      font-style: italic;
      font-weight: 500;
      font-size: 0.84em;
      white-space: pre-wrap;
      overflow-wrap: break-word;
    }
    .song-error {
      color: #b91c1c;
      font-style: italic;
      font-size: 10pt;
    }

    /* Pie de página con numeración (sólo en impresión) */
    @media print {
      .cover { padding-top: 20mm; }
    }
  </style>
  <style>${SHEET_CSS}</style>
  <style>
    /* Después de SHEET_CSS, que define sus colores en el body: en papel,
       el azul de los acordes de la app se queda flojo. */
    body { --sh-chord: #0055A4; }
  </style>
</head>
<body class="${bodyClass}">
  <section class="cover">
    <div class="cover-eyebrow">Playlist · MCM</div>
    <h1 class="cover-title">${escapeHtml(opts.playlistName)}</h1>
    <div class="cover-rule"></div>
    <div class="cover-meta">${coverMeta}</div>
    <div class="cover-toc">
      ${opts.songs
        .map((s, i) => {
          const t = escapeHtml(cleanTitle(s.title));
          const transpose = s.transpose ?? 0;
          let keyStr = '';
          if (s.key) {
            const original = s.key.toUpperCase();
            const target =
              transpose !== 0 ? transposeKey(original, transpose) : original;
            keyStr = escapeHtml(convertChord(target, opts.notation));
          }
          const tocCapo =
            s.capoOverride !== null && s.capoOverride !== undefined
              ? s.capoOverride
              : s.capo;
          const capoStr =
            tocCapo && tocCapo > 0
              ? ` · C${tocCapo}${s.capoOverride !== null && s.capoOverride !== undefined ? '✱' : ''}`
              : '';
          return `<div class="cover-toc-item">
            <span class="cover-toc-num">${i + 1}.</span>
            <span class="cover-toc-title">${t}</span>
            ${keyStr ? `<span class="cover-toc-key">${keyStr}${escapeHtml(capoStr)}</span>` : ''}
          </div>`;
        })
        .join('')}
    </div>
  </section>
  ${songs}
</body>
</html>`;
}

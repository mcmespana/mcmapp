/**
 * Construye el HTML imprimible (PDF) de una playlist a partir de canciones
 * en formato ChordPro. Usa ChordSheetJS para parsear y `HtmlDivFormatter`
 * para volcar el cuerpo de cada canción; encima añade una capa propia
 * de estilo "cancionero moderno" pensada para A4.
 *
 * Decisiones de diseño:
 *  - Tipografía sans-serif moderna (Inter desde Google Fonts, fallback al
 *    stack del sistema). Si el dispositivo está offline al imprimir,
 *    el fallback es perfectamente legible.
 *  - Título 20pt, metadatos (autor/tono/cejilla) alineados a la derecha en
 *    gris, encima de la línea separadora.
 *  - Acordes en negrita color #0055A4. Letra 13pt, interlineado 1.55.
 *  - `page-break-inside: avoid` para cada canción → si entra en la
 *    página actual no se parte; si no cabe, salta a la siguiente y
 *    empieza arriba. Si la canción es más larga que una página, el
 *    navegador la parte por filas (cabecera se queda con la primera
 *    fila gracias al wrapper).
 *  - Opción de "una canción por página" → `page-break-after: always`.
 *  - Encabezado de página fijo con el nombre de la playlist (esquina
 *    superior izquierda) y numeración (esquina inferior derecha) vía
 *    @page + counter.
 */

import {
  ChordProParser,
  HtmlDivFormatter,
  Song as ChordSong,
} from 'chordsheetjs';
import { convertHtmlChords, convertChord, Notation } from './chordNotation';
import { transposeKey } from './transposeKey';

export interface PdfSongInput {
  title: string;
  author?: string;
  key?: string;
  capo?: number;
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
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const cleanTitle = (t: string) => t.replace(/^\d+\.\s*/, '').trim();

/** Renderiza una canción a HTML usando ChordSheetJS, con transpose aplicado. */
function renderSongBody(content: string, transpose: number): string {
  let chordPro = content
    .replace(/\{sov\}/gi, '{start_of_verse}')
    .replace(/\{eov\}/gi, '{end_of_verse}')
    .replace(/\{soc\}/gi, '{start_of_chorus}')
    .replace(/\{eoc\}/gi, '{end_of_chorus}')
    .replace(/\{sob\}/gi, '{start_of_bridge}')
    .replace(/\{eob\}/gi, '{end_of_bridge}')
    .replace(/\{transpose:.*\}\n?/gi, '');

  if (transpose && transpose !== 0) {
    const v = transpose < 0 ? transpose + 12 : transpose;
    if (v !== 0) chordPro = `{transpose: ${v}}\n${chordPro}`;
  }

  const parser = new ChordProParser();
  const parsed: ChordSong = parser.parse(chordPro);
  const formatter = new HtmlDivFormatter();
  let html = formatter.format(parsed);
  // El formatter mete un <h1> con el título de la canción si está en el
  // ChordPro; lo quitamos porque ya pintamos cabecera propia.
  html = html.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, '');
  html = html.replace(/<h2[^>]*>[\s\S]*?<\/h2>/i, '');
  return html;
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
  if (song.capo && song.capo > 0) {
    metaParts.push(`<span class="meta-tag">Cejilla ${song.capo}</span>`);
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
  if (song.content && song.content.trim()) {
    try {
      body = renderSongBody(song.content, transpose);
      body = convertHtmlChords(body, opts.notation);
    } catch (e) {
      body = `<p class="song-error">No se pudo procesar el ChordPro: ${escapeHtml(
        (e as Error).message,
      )}</p>`;
    }
  } else {
    body = `<p class="song-error">Sin contenido.</p>`;
  }

  const breakClass = opts.pageBreakPerSong ? 'song page-break-after' : 'song';
  return `
    <article class="${breakClass}">
      <header class="song-header">
        <h2 class="song-title">${title}</h2>
        ${meta}
      </header>
      <div class="song-body ${opts.showChords ? '' : 'no-chords'}">
        ${body}
      </div>
    </article>
  `;
}

export function buildPlaylistPdfHtml(opts: PdfBuildOptions): string {
  const lyricsPt = Math.max(10, Math.min(18, opts.lyricsFontPt));
  const chordPt = (lyricsPt * 0.95).toFixed(2);
  const songs = opts.songs.map((s) => songBlock(s, opts)).join('\n');

  const today = new Date().toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

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
    .meta-author {
      color: #6b7280;
      font-style: italic;
    }
    .song-body {
      font-size: ${lyricsPt}pt;
      line-height: 1.55;
    }

    /* ───── Cuerpo (HtmlDivFormatter) ─────────────────────── */
    .chord-sheet {
      max-width: 100%;
    }
    .paragraph {
      margin: 0 0 ${(lyricsPt * 0.9).toFixed(1)}pt 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .paragraph.chorus {
      border-left: 2.5pt solid #0055A4;
      padding-left: 9pt;
      margin-left: 0;
      background: linear-gradient(90deg, rgba(0,85,164,0.04), transparent 70%);
    }
    .paragraph.chorus .lyrics {
      font-weight: 600;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      margin-bottom: 2pt;
    }
    .column {
      display: flex;
      flex-direction: column;
      padding-right: 1pt;
      min-height: ${(lyricsPt * 1.5).toFixed(1)}pt;
    }
    .chord {
      color: #0055A4;
      font-weight: 700;
      font-size: ${chordPt}pt;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      letter-spacing: -0.01em;
      line-height: 1.1;
      min-height: ${(lyricsPt * 1.05).toFixed(1)}pt;
      white-space: pre;
    }
    .lyrics {
      color: #1a1a1a;
      white-space: pre;
      line-height: 1.35;
    }
    .comment, .c {
      display: block;
      color: #475569;
      font-style: italic;
      font-size: ${(lyricsPt * 0.92).toFixed(1)}pt;
      margin: 4pt 0;
    }
    .no-chords .chord {
      display: none !important;
    }
    .no-chords .column {
      min-height: ${(lyricsPt * 1.1).toFixed(1)}pt;
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
</head>
<body>
  <section class="cover">
    <div class="cover-eyebrow">Playlist · MCM</div>
    <h1 class="cover-title">${escapeHtml(opts.playlistName)}</h1>
    <div class="cover-rule"></div>
    <div class="cover-meta">${opts.songs.length} ${opts.songs.length === 1 ? 'canción' : 'canciones'} · ${escapeHtml(today)}</div>
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
          return `<div class="cover-toc-item">
            <span class="cover-toc-num">${i + 1}.</span>
            <span class="cover-toc-title">${t}</span>
            ${keyStr ? `<span class="cover-toc-key">${keyStr}</span>` : ''}
          </div>`;
        })
        .join('')}
    </div>
  </section>
  ${songs}
</body>
</html>`;
}

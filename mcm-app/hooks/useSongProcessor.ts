import { logger } from '@/utils/logger';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { ChordProParser, HtmlDivFormatter, Song } from 'chordsheetjs';
import { UIColors } from '@/constants/colors';
import {
  convertHtmlChords,
  convertChord,
  Notation,
} from '../utils/chordNotation';
import { transposeKey } from '../utils/transposeKey';
import {
  preprocessArrangements,
  postProcessArrangementsHtml,
  injectRowLineIndices,
} from '../utils/arrangements';

export interface UseSongProcessorParams {
  originalChordPro: string | null;
  currentTranspose: number;
  chordsVisible: boolean;
  /** Mostrar anotaciones de arreglo `{arr:}`. Default true. */
  arrangementsVisible?: boolean;
  currentFontSizeEm: number;
  currentFontFamily: string;
  notation: Notation;
  title?: string;
  author?: string;
  key?: string;
  capo?: number;
  isFullscreen?: boolean;
  isDark?: boolean;
  /** Padding superior extra (px). Útil en fullscreen para evitar notch / close button. */
  topInset?: number;
  /** Padding inferior extra (px). Útil en fullscreen para no esconder texto bajo play/safe-area. */
  bottomInset?: number;
  /**
   * Modo admin: si es true, cada línea renderizada se etiqueta con el índice de
   * su línea en el ChordPro original y un long-press sobre ella envía ese índice
   * a RN (mensaje `{ type: 'arr-longpress', line }`) para insertar un `{arr:}`.
   */
  adminMode?: boolean;
}

/**
 * Live style snapshot that the WebView can apply without reloading the HTML.
 * Anything in this object can be flipped via `postMessage` / `injectJavaScript`
 * by reading `__SONG_BRIDGE__` inside the document.
 */
export interface SongStyleState {
  fontSize: number;
  fontFamily: string;
  isDark: boolean;
  chordsVisible: boolean;
  arrangementsVisible: boolean;
  topPadding: number;
  bottomPadding: number;
}

/**
 * Detalle de un error de sintaxis al parsear el ChordPro de una canción.
 * Lo usamos tanto para pintar una pantalla de error amable como para
 * reportarlo a Firebase (`songs/fallitos`).
 */
export interface SongParseError {
  /** Mensaje crudo del parser (peggy). */
  message: string;
  /** Línea (1-based) donde el parser detectó el problema, si la conocemos. */
  line: number | null;
  /** Columna (1-based) del problema, si la conocemos. */
  column: number | null;
  /** Texto de la línea problemática (tal cual la vio el parser). */
  lineText: string | null;
  /**
   * Pequeño contexto alrededor del error (línea anterior, la del error y la
   * siguiente) para dar pistas: el parser PEG a veces apunta a la línea de
   * después del fallo real, así que ver el entorno ayuda a localizarlo.
   */
  context: { n: number; text: string; isError: boolean }[];
}

interface ParsedResult {
  song: Song | null;
  error: SongParseError | null;
}

// ─── Module-level cache for parsed ChordPro ───
// Pre-procesar `.cho` en build time (Metro Transformer) no aplica aquí porque
// las canciones viven en Firebase, no en el bundle. La alternativa más cercana
// es cachear el objeto `Song` parseado a nivel de módulo, de modo que abrir y
// cerrar una canción no la re-parsee. Limitamos el tamaño con FIFO básico.
const PARSED_CACHE = new Map<string, ParsedResult>();
const PARSED_CACHE_LIMIT = 64;
function parseChordPro(chordPro: string): ParsedResult {
  const cached = PARSED_CACHE.get(chordPro);
  if (cached !== undefined) return cached;
  const cleaned = preprocessArrangements(chordPro)
    .replace(/\{sov\}/gi, '{start_of_verse}')
    .replace(/\{eov\}/gi, '{end_of_verse}')
    .replace(/\{soc\}/gi, '{start_of_chorus}')
    .replace(/\{eoc\}/gi, '{end_of_chorus}')
    .replace(/\{sob\}/gi, '{start_of_bridge}')
    .replace(/\{eob\}/gi, '{end_of_bridge}')
    .replace(/\{transpose:.*\}\n?/gi, '');
  // `HtmlDivFormatter` de ChordSheetJS NO escapa el texto libre al formatear:
  // título, autor, comentarios y letra se emiten tal cual dentro del HTML
  // (verificado: `{title: <script>}` produce `<h1><script>` literal). El
  // ChordPro viene de Firebase (`/songs/data`, escribible públicamente), así
  // que escapamos ANTES de parsear — `& < > "` no forman parte de la sintaxis
  // ChordPro (`{directivas}`, `[acordes]`, comentarios `#`), así que el
  // parseo no se ve afectado. Usamos `cleaned` SIN escapar para el contexto
  // de error de abajo (que ya escapa una vez en `buildErrorHtml`; escapar
  // aquí también produciría doble-escape visual). Efecto secundario acotado:
  // si la línea del error contiene alguno de esos caracteres antes del punto
  // exacto del fallo, la COLUMNA reportada puede desplazarse (la línea
  // sigue siendo correcta) — tradeoff aceptado por seguridad.
  let result: ParsedResult;
  try {
    result = {
      song: new ChordProParser().parse(escapeHtml(cleaned)),
      error: null,
    };
  } catch (e: any) {
    logger.error('Error parseando ChordPro en useSongProcessor:', e);
    // Los errores del parser (peggy/PEG.js) traen `location.start.line/column`.
    const loc = e?.location?.start;
    const line =
      typeof loc?.line === 'number' && loc.line > 0 ? loc.line : null;
    const column =
      typeof loc?.column === 'number' && loc.column > 0 ? loc.column : null;
    let lineText: string | null = null;
    const context: { n: number; text: string; isError: boolean }[] = [];
    if (line !== null) {
      const allLines = cleaned.split(/\r?\n/);
      lineText = allLines[line - 1] ?? null;
      const from = Math.max(1, line - 1);
      const to = Math.min(allLines.length, line + 1);
      for (let n = from; n <= to; n++) {
        context.push({ n, text: allLines[n - 1] ?? '', isError: n === line });
      }
    }
    result = {
      song: null,
      error: {
        message: typeof e?.message === 'string' ? e.message : String(e),
        line,
        column,
        lineText,
        context,
      },
    };
  }
  if (PARSED_CACHE.size >= PARSED_CACHE_LIMIT) {
    const firstKey = PARSED_CACHE.keys().next().value;
    if (firstKey !== undefined) PARSED_CACHE.delete(firstKey);
  }
  PARSED_CACHE.set(chordPro, result);
  return result;
}

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Pantalla de error amable (en vez del texto plano en Times New Roman) cuando
 * una canción tiene un error de sintaxis y no se puede renderizar.
 */
function buildErrorHtml(
  error: SongParseError | null,
  isDark: boolean,
  fontFamily: string,
): string {
  // Paleta cálida alrededor del rojo MCM (#E15C62) para que el error se sienta
  // amable y no alarmante.
  const pageBg = isDark ? '#1F1F21' : '#FBF7F6';
  const cardBg = isDark ? '#2C2C2E' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(225,92,98,0.10)';
  const cardShadow = isDark
    ? '0 18px 50px rgba(0,0,0,0.45)'
    : '0 18px 50px rgba(225,92,98,0.12)';
  const text = isDark ? '#F2F2F4' : '#1F2430';
  const subtle = isDark ? '#9A9AA0' : '#9A8F8F';
  const accent = isDark ? '#FF8A80' : '#E15C62';
  const accentSoft = isDark ? '#FFB3AC' : '#EE7E83';
  const haloGlow = isDark ? 'rgba(255,138,128,0.22)' : 'rgba(225,92,98,0.16)';
  const codeBg = isDark ? 'rgba(255,138,128,0.08)' : 'rgba(225,92,98,0.05)';
  const codeBorder = isDark ? 'rgba(255,138,128,0.24)' : 'rgba(225,92,98,0.18)';
  const codeText = isDark ? '#E8E8EC' : '#43484F';

  const lineInfo =
    error?.line != null
      ? `<div class="err-line-label">📍 Línea ${error.line}${
          error.column != null ? ` · col. ${error.column}` : ''
        }</div>`
      : '';

  // Bloque de contexto con números de línea; la del error va resaltada.
  const ctx = error?.context ?? [];
  const codeRows =
    ctx.length > 0
      ? ctx
          .map(
            (l) =>
              `<div class="err-row${l.isError ? ' is-error' : ''}">` +
              `<span class="err-gutter">${l.n}</span>` +
              `<span class="err-line">${escapeHtml(l.text) || ' '}</span>` +
              `</div>`,
          )
          .join('')
      : error?.lineText != null && error.lineText.trim() !== ''
        ? `<div class="err-row is-error"><span class="err-line">${escapeHtml(
            error.lineText,
          )}</span></div>`
        : '';
  const codeBlock = codeRows
    ? `<div class="err-codecard">
        <div class="err-codecard-bar"><span></span><span></span><span></span></div>
        <div class="err-code">${codeRows}</div>
      </div>`
    : '';

  // Mensaje del parser como pista (p.ej. 'Expected "}" but "[" found.').
  const hint =
    error?.message && error.message.trim() !== ''
      ? `<div class="err-hint"><span class="err-hint-tag">Pista</span>${escapeHtml(
          error.message.trim(),
        )}</div>`
      : '';

  return `<!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
    <style>
      * { box-sizing: border-box; }
      html, body { height: 100%; margin: 0; }
      body {
        font-family: ${fontFamily};
        background:
          radial-gradient(120% 60% at 50% -10%, ${haloGlow} 0%, transparent 55%),
          ${pageBg};
        color: ${text};
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 28px 22px;
        -webkit-font-smoothing: antialiased;
      }
      .err-card {
        max-width: 380px;
        width: 100%;
        text-align: center;
        background: ${cardBg};
        border: 1px solid ${cardBorder};
        border-radius: 26px;
        box-shadow: ${cardShadow};
        padding: 34px 26px 28px;
        animation: err-pop 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      @keyframes err-pop {
        from { opacity: 0; transform: translateY(14px) scale(0.96); }
        to   { opacity: 1; transform: translateY(0)    scale(1); }
      }
      .err-badge {
        position: relative;
        width: 92px;
        height: 92px;
        margin: 0 auto 20px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background:
          radial-gradient(circle at 50% 38%, ${haloGlow} 0%, transparent 70%);
      }
      .err-badge::before {
        content: '';
        position: absolute;
        inset: 14px;
        border-radius: 50%;
        background: ${codeBg};
        border: 1.5px solid ${codeBorder};
      }
      .err-emoji {
        position: relative;
        font-size: 44px;
        line-height: 1;
        animation: err-float 3.2s ease-in-out infinite;
      }
      @keyframes err-float {
        0%, 100% { transform: translateY(0) rotate(-2deg); }
        50%      { transform: translateY(-4px) rotate(2deg); }
      }
      .err-title {
        font-size: 1.55em;
        font-weight: 800;
        margin: 0 0 6px;
        color: ${accent};
        letter-spacing: -0.015em;
      }
      .err-sub {
        font-size: 1.02em;
        font-weight: 600;
        line-height: 1.4;
        margin: 0 auto 18px;
        max-width: 17em;
        color: ${text};
      }
      .err-line-label {
        display: inline-block;
        font-size: 0.74em;
        font-weight: 700;
        letter-spacing: 0.01em;
        color: ${accentSoft};
        background: ${codeBg};
        border: 1px solid ${codeBorder};
        padding: 5px 13px;
        border-radius: 999px;
        margin-bottom: 12px;
      }
      .err-codecard {
        text-align: left;
        background: ${codeBg};
        border: 1px solid ${codeBorder};
        border-radius: 14px;
        overflow: hidden;
        margin: 0 0 16px;
      }
      .err-codecard-bar {
        display: flex;
        gap: 6px;
        padding: 9px 12px;
        border-bottom: 1px solid ${codeBorder};
      }
      .err-codecard-bar span {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: ${accentSoft};
        opacity: 0.55;
      }
      .err-code {
        font-family: 'Roboto Mono', 'Courier New', monospace;
        font-size: 0.84em;
        line-height: 1.55;
        margin: 0;
        padding: 8px 0;
        color: ${codeText};
      }
      .err-row {
        display: flex;
        align-items: baseline;
        padding: 1px 14px 1px 0;
      }
      .err-row.is-error {
        background: ${haloGlow};
        box-shadow: inset 3px 0 0 ${accent};
      }
      .err-gutter {
        flex: 0 0 auto;
        width: 2.6em;
        padding-right: 12px;
        text-align: right;
        color: ${subtle};
        opacity: 0.7;
        user-select: none;
      }
      .err-row.is-error .err-gutter {
        color: ${accent};
        opacity: 1;
        font-weight: 700;
      }
      .err-line {
        flex: 1 1 auto;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .err-hint {
        text-align: left;
        font-size: 0.76em;
        line-height: 1.5;
        color: ${subtle};
        background: ${codeBg};
        border: 1px dashed ${codeBorder};
        border-radius: 12px;
        padding: 10px 13px;
        margin: 0 0 22px;
        word-break: break-word;
      }
      .err-hint-tag {
        display: inline-block;
        font-size: 0.82em;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: ${accent};
        margin-right: 8px;
      }
      .err-foot {
        font-size: 0.72em;
        line-height: 1.5;
        color: ${subtle};
        margin: 0;
        opacity: 0.92;
      }
      .err-foot::before {
        content: '';
        display: block;
        width: 34px;
        height: 2px;
        border-radius: 2px;
        margin: 0 auto 12px;
        background: linear-gradient(90deg, transparent, ${codeBorder}, transparent);
      }
    </style>
  </head><body>
    <div class="err-card">
      <div class="err-badge"><span class="err-emoji">😅</span></div>
      <h1 class="err-title">Ay, mecachis</h1>
      <p class="err-sub">Hay un error procesando esta canción</p>
      ${lineInfo}
      ${codeBlock}
      ${hint}
      <p class="err-foot">Hemos avisado a la gente maja que mantiene el cantoral para arreglarlo</p>
    </div>
  </body></html>`;
}

const themeVarsFor = (isDark: boolean) => ({
  bodyBg: isDark ? '#2C2C2E' : '#ffffff',
  bodyText: isDark ? '#E5E5EA' : '#212529',
  titleText: isDark ? '#F5F5F7' : '#1C1C1E',
  authorText: isDark ? '#98989D' : '#8E8E93',
  chordColor: isDark ? '#64B5F6' : UIColors.activePrimary,
  commentText: isDark ? '#98989D' : UIColors.secondaryText,
  badgeBg: isDark ? 'rgba(244, 193, 30, 0.12)' : 'rgba(37, 56, 131, 0.06)',
  badgeText: isDark ? '#F4C11E' : '#253883',
  badgeAccentBg: isDark ? 'rgba(225, 92, 98, 0.15)' : 'rgba(225, 92, 98, 0.08)',
  badgeAccentText: isDark ? '#FF8A80' : '#C62828',
  fsBgTop: isDark ? 'rgba(44,44,46,0.97)' : 'rgba(255,255,255,0.97)',
  fsBgMid: isDark ? 'rgba(44,44,46,0.88)' : 'rgba(255,255,255,0.88)',
});

const defaultBottomPadding = (isFullscreen: boolean) =>
  isFullscreen
    ? 110
    : Platform.OS === 'ios'
      ? 120
      : Platform.OS === 'web'
        ? 40
        : 80;

const defaultTopPadding = (isFullscreen: boolean) => (isFullscreen ? 72 : 16);

export const useSongProcessor = ({
  originalChordPro,
  currentTranspose,
  chordsVisible,
  arrangementsVisible = true,
  currentFontSizeEm,
  currentFontFamily,
  notation,
  title,
  author,
  key,
  capo,
  isFullscreen = false,
  isDark = false,
  topInset,
  bottomInset,
  adminMode = false,
}: UseSongProcessorParams) => {
  const [songHtml, setSongHtml] = useState<string>('Cargando…');
  const [isLoadingSong, setIsLoadingSong] = useState<boolean>(true);

  const parsed = useMemo<ParsedResult>(() => {
    if (!originalChordPro) return { song: null, error: null };
    return parseChordPro(originalChordPro);
  }, [originalChordPro]);
  const baseSong = parsed.song;
  const songError = parsed.error;

  // Style snapshot for live updates. Computed every render but stable per
  // structural pass thanks to derived values.
  const topPadding =
    topInset !== undefined ? topInset : defaultTopPadding(isFullscreen);
  const bottomPadding =
    bottomInset !== undefined
      ? bottomInset
      : defaultBottomPadding(isFullscreen);

  const styleState = useMemo<SongStyleState>(
    () => ({
      fontSize: currentFontSizeEm,
      fontFamily: currentFontFamily,
      isDark,
      chordsVisible,
      arrangementsVisible,
      topPadding,
      bottomPadding,
    }),
    [
      currentFontSizeEm,
      currentFontFamily,
      isDark,
      chordsVisible,
      arrangementsVisible,
      topPadding,
      bottomPadding,
    ],
  );

  // Capture latest style in a ref so we can bake current values into HTML
  // whenever structural deps change (without re-running the structural effect
  // on every style change).
  const styleRef = useRef(styleState);
  styleRef.current = styleState;

  useEffect(() => {
    if (!originalChordPro) {
      setIsLoadingSong(false);
      return;
    }
    if (!baseSong) {
      setSongHtml(
        buildErrorHtml(
          songError,
          styleRef.current.isDark,
          styleRef.current.fontFamily,
        ),
      );
      setIsLoadingSong(false);
      return;
    }

    setIsLoadingSong(true);
    try {
      const s = styleRef.current;
      const c = themeVarsFor(s.isDark);

      const songForFormatting: Song =
        currentTranspose !== 0
          ? baseSong.transpose(currentTranspose)
          : baseSong;

      const formatter = new HtmlDivFormatter();
      let formattedSong = postProcessArrangementsHtml(
        formatter.format(songForFormatting),
      );
      // En modo admin, etiquetamos cada fila con el índice de su línea en el
      // ChordPro original para poder insertar arreglos por long-press. La
      // transposición no altera el número/orden de filas, así que mapeamos
      // sobre el ChordPro original (no el transpuesto).
      if (adminMode && originalChordPro) {
        formattedSong = injectRowLineIndices(formattedSong, originalChordPro);
      }

      let metaInsert = '';
      if (author && !isFullscreen) {
        metaInsert += `<div class="song-meta-author">${escapeHtml(author)}</div>`;
      }

      const displayKey = key
        ? currentTranspose !== 0
          ? transposeKey(key, currentTranspose)
          : key.toUpperCase()
        : '';
      // `key` viene de texto libre del ChordPro (`{key: ...}`), que puede
      // venir de Firebase (`/songs/data` es escribible públicamente). Escapar
      // DESPUÉS de convertChord: su regex solo busca letras A-G, así que
      // corre seguro sobre la cadena cruda; el resultado ya no debe
      // interpolarse sin escapar.
      const displayKeyHtml = escapeHtml(convertChord(displayKey, notation));

      let badges = '';
      if (displayKey) {
        badges += `<span class="meta-badge">${displayKeyHtml}</span>`;
      }
      if (capo !== undefined && capo > 0) {
        badges += `<span class="meta-badge">Cejilla ${capo}</span>`;
      }
      if (currentTranspose !== 0) {
        const transposeDisplay =
          currentTranspose > 0 ? `+${currentTranspose}` : `${currentTranspose}`;
        badges += `<span class="meta-badge meta-badge-accent">${transposeDisplay} semitonos</span>`;
      }
      if (badges && !isFullscreen) {
        metaInsert += `<div class="song-meta-keycapo">${badges}</div>`;
      }

      let fsHeader = '';
      if (isFullscreen) {
        let fsMeta = '';
        if (author)
          fsMeta += `<span class="fs-author">${escapeHtml(author)}</span>`;
        if (displayKey) {
          if (fsMeta) fsMeta += `<span class="fs-sep">·</span>`;
          fsMeta += `<span class="fs-badge-sm">${displayKeyHtml}</span>`;
        }
        if (capo !== undefined && capo > 0) {
          fsMeta += `<span class="fs-badge-sm">Cejilla ${capo}</span>`;
        }
        if (currentTranspose !== 0) {
          const td =
            currentTranspose > 0
              ? `+${currentTranspose}`
              : `${currentTranspose}`;
          fsMeta += `<span class="fs-badge-sm fs-badge-accent">${td} semitonos</span>`;
        }
        fsHeader = `<div class="fs-header">${title ? `<div class="fs-title">${escapeHtml(title)}</div>` : ''}${fsMeta ? `<div class="fs-meta">${fsMeta}</div>` : ''}</div>`;
      }

      let finalSongContentWithMeta = formattedSong;
      if (metaInsert) {
        const titleEndTag = '</h1>';
        const titleEndIndex = formattedSong.indexOf(titleEndTag);
        if (titleEndIndex !== -1) {
          const insertionPoint = titleEndIndex + titleEndTag.length;
          finalSongContentWithMeta =
            formattedSong.substring(0, insertionPoint) +
            metaInsert +
            formattedSong.substring(insertionPoint);
        } else {
          finalSongContentWithMeta = metaInsert + formattedSong;
        }
      }

      // ── Bootstrap script: receives postMessage / injectJavaScript calls
      // ── and updates CSS variables / classes live without reloading HTML.
      const bootstrap = `
        (function(){
          var docEl = document.documentElement;
          function apply(s) {
            if (!s || typeof s !== 'object') return;
            var r = docEl.style;
            if (typeof s.fontSize === 'number') r.setProperty('--song-font-size', s.fontSize + 'em');
            if (typeof s.fontFamily === 'string') r.setProperty('--song-font-family', s.fontFamily);
            if (typeof s.topPadding === 'number') r.setProperty('--song-pad-top', s.topPadding + 'px');
            if (typeof s.bottomPadding === 'number') r.setProperty('--song-pad-bottom', s.bottomPadding + 'px');
            if (typeof s.isDark === 'boolean') {
              document.body.classList.toggle('theme-dark', s.isDark);
            }
            if (typeof s.chordsVisible === 'boolean') {
              document.body.classList.toggle('chords-hidden', !s.chordsVisible);
            }
            if (typeof s.arrangementsVisible === 'boolean') {
              document.body.classList.toggle('arr-hidden', !s.arrangementsVisible);
            }
          }
          window.__SONG_BRIDGE__ = { apply: apply };
          function onMessage(ev) {
            try {
              var data = typeof ev.data === 'string' ? ev.data : '';
              if (!data) return;
              apply(JSON.parse(data));
            } catch (_) {}
          }
          // RN WebView (Android) dispatches on document, iOS/web on window.
          document.addEventListener('message', onMessage);
          window.addEventListener('message', onMessage);

          ${
            adminMode
              ? `
          // ── Modo admin: long-press sobre una fila → avisar a RN con el índice
          // de la línea original (data-line) para insertar un {arr:} encima. ──
          (function(){
            function post(payload) {
              var msg = JSON.stringify(payload);
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(msg);
              } else if (window.parent && window.parent !== window) {
                window.parent.postMessage(msg, '*'); // web (iframe)
              }
            }
            var timer = null, startX = 0, startY = 0, target = null, fired = false;
            var MOVE_CANCEL = 12, DELAY = 450;
            function rowFor(el) {
              while (el && el !== document.body) {
                if (el.classList && el.classList.contains('row') &&
                    el.hasAttribute('data-line')) return el;
                el = el.parentElement;
              }
              return null;
            }
            function flash(el) {
              var prev = el.style.backgroundColor;
              el.style.transition = 'background-color 0.15s ease';
              el.style.backgroundColor = 'rgba(225,92,98,0.18)';
              setTimeout(function(){ el.style.backgroundColor = prev; }, 220);
            }
            function clear() { if (timer) { clearTimeout(timer); timer = null; } target = null; }
            function start(x, y, el) {
              var row = rowFor(el);
              if (!row) return;
              target = row; startX = x; startY = y; fired = false;
              timer = setTimeout(function(){
                fired = true;
                var line = parseInt(target.getAttribute('data-line'), 10);
                if (!isNaN(line)) { flash(target); post({ type: 'arr-longpress', line: line }); }
                clear();
              }, DELAY);
            }
            document.addEventListener('touchstart', function(e){
              if (!e.touches || !e.touches.length) return;
              start(e.touches[0].clientX, e.touches[0].clientY, e.target);
            }, { passive: true });
            document.addEventListener('touchmove', function(e){
              if (!timer || !e.touches || !e.touches.length) return;
              var dx = Math.abs(e.touches[0].clientX - startX);
              var dy = Math.abs(e.touches[0].clientY - startY);
              if (dx > MOVE_CANCEL || dy > MOVE_CANCEL) clear();
            }, { passive: true });
            document.addEventListener('touchend', function(){ clear(); }, { passive: true });
            document.addEventListener('touchcancel', function(){ clear(); }, { passive: true });
            // Soporte ratón (web): mousedown/up con el mismo retardo.
            document.addEventListener('mousedown', function(e){ start(e.clientX, e.clientY, e.target); });
            document.addEventListener('mousemove', function(e){
              if (!timer) return;
              if (Math.abs(e.clientX - startX) > MOVE_CANCEL || Math.abs(e.clientY - startY) > MOVE_CANCEL) clear();
            });
            document.addEventListener('mouseup', function(){ clear(); });
            // Evitar el menú contextual del navegador en long-press (web).
            document.addEventListener('contextmenu', function(e){ e.preventDefault(); });
          })();
          `
              : ''
          }
        })();
      `;

      // CSS variables driven by styleState. Defaults match current snapshot
      // so the first render looks right with no extra round-trip.
      const cssVars = `
        :root {
          --song-font-size: ${s.fontSize}em;
          --song-font-family: ${s.fontFamily};
          --song-pad-top: ${s.topPadding}px;
          --song-pad-bottom: ${s.bottomPadding}px;
        }
      `;

      let finalHtml = `
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
          <style>
            ${cssVars}
            * { box-sizing: border-box; }
            body {
              font-family: var(--song-font-family);
              margin: 0;
              padding: var(--song-pad-top) 16px var(--song-pad-bottom) 16px;
              background-color: ${c.bodyBg};
              color: ${c.bodyText};
              font-size: 100%;
              max-width: 100%;
              overflow-wrap: break-word;
              word-wrap: break-word;
              -webkit-text-size-adjust: 100%;
              -webkit-font-smoothing: antialiased;
              scrollbar-width: none;
              -ms-overflow-style: none;
              transition: background-color 0.15s ease, color 0.15s ease;
            }
            /* Dark theme — toggled live via .theme-dark on <body>. The default
               above is whichever the page was rendered with; flipping the
               class swaps the palette without reload. */
            body.theme-dark {
              background-color: #2C2C2E;
              color: #E5E5EA;
            }
            body.theme-dark h1 { color: #F5F5F7; }
            body.theme-dark .song-meta-author { color: #98989D; }
            body.theme-dark .chord-sheet .chord { color: #64B5F6; }
            body.theme-dark .comment, body.theme-dark .c { color: #98989D; }
            body.theme-dark .arrangement { color: #FF8A80; }
            body.theme-dark .meta-badge {
              background: rgba(244, 193, 30, 0.12);
              color: #F4C11E;
            }
            body.theme-dark .meta-badge-accent {
              background: rgba(225, 92, 98, 0.15);
              color: #FF8A80;
            }
            body:not(.theme-dark) {
              background-color: #ffffff;
              color: #212529;
            }
            body:not(.theme-dark) h1 { color: #1C1C1E; }
            body:not(.theme-dark) .song-meta-author { color: #8E8E93; }
            body:not(.theme-dark) .chord-sheet .chord { color: ${UIColors.activePrimary}; }
            body:not(.theme-dark) .comment, body:not(.theme-dark) .c { color: ${UIColors.secondaryText}; }
            body:not(.theme-dark) .arrangement { color: #E15C62; }
            body:not(.theme-dark) .meta-badge {
              background: rgba(37, 56, 131, 0.06);
              color: #253883;
            }
            body:not(.theme-dark) .meta-badge-accent {
              background: rgba(225, 92, 98, 0.08);
              color: #C62828;
            }
            /* Live toggle: hide chords when body has .chords-hidden */
            body.chords-hidden .chord { display: none !important; }
            /* Anotaciones de arreglo {arr:} — sutiles y alineadas a la derecha
               como rasgo distintivo. Toggle en vivo con .arr-hidden. */
            .arrangement {
              display: block;
              text-align: right;
              font-style: italic;
              font-weight: 500;
              font-size: calc(var(--song-font-size) * 0.78);
              line-height: 1.3;
              margin: 0.35em 0 0.55em;
              opacity: 0.95;
              white-space: pre-wrap;
              word-wrap: break-word;
              overflow-wrap: break-word;
              max-width: 100%;
            }
            body.arr-hidden .arrangement { display: none !important; }
            @media (min-width: 720px) {
              body { padding-left: max(16px, calc((100% - ${isFullscreen ? 920 : 760}px) / 2)); padding-right: max(16px, calc((100% - ${isFullscreen ? 920 : 760}px) / 2)); }
            }
            body::-webkit-scrollbar { width: 0; height: 0; }
            h1 {
              margin: 4px 0 8px;
              font-size: 1.35em;
              font-weight: 700;
              text-align: left;
              line-height: 1.25;
              letter-spacing: -0.01em;
              padding-bottom: 12px;
              position: relative;
              ${isFullscreen ? 'display: none;' : ''}
            }
            h1::after {
              content: '';
              position: absolute;
              bottom: 0;
              left: 0;
              width: 40px;
              height: 3px;
              background: linear-gradient(90deg, #f4c11e, #E15C62);
              border-radius: 2px;
            }
            .song-meta-author {
              font-size: 0.88em;
              margin: 0 0 10px;
              font-style: italic;
              font-weight: 400;
              text-align: left;
            }
            .song-meta-keycapo {
              display: flex;
              flex-wrap: wrap;
              gap: 6px;
              margin-bottom: 16px;
            }
            .meta-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 16px;
              font-size: 0.78em;
              font-weight: 600;
              letter-spacing: 0.02em;
            }
            .chord-sheet {
              margin-top: 0.5em;
              text-align: left;
              max-width: 100%;
              overflow: hidden;
            }
            .row {
              display: flex;
              flex-wrap: wrap;
              margin-bottom: 0.2em;
              max-width: 100%;
            }
            .column {
              padding-right: 0;
              max-width: 100%;
              overflow-wrap: break-word;
              word-wrap: break-word;
            }
            .chord-sheet .chord {
              font-weight: bold;
              white-space: pre;
              display: block;
              min-height: 1.2em;
              font-size: var(--song-font-size);
            }
            .chord-sheet .lyrics {
              white-space: pre-wrap;
              word-wrap: break-word;
              overflow-wrap: break-word;
              display: block;
              min-height: 1.2em;
              max-width: 100%;
              font-size: var(--song-font-size);
            }
            .comment, .c {
              font-style: italic;
              white-space: pre-wrap;
              word-wrap: break-word;
              overflow-wrap: break-word;
              display: block;
              margin-top: 0.5em;
              margin-bottom: 0.5em;
              max-width: 100%;
            }
            .paragraph {
              margin-top: 1.2em;
              margin-bottom: 1.2em;
              white-space: pre-wrap;
              word-wrap: break-word;
              overflow-wrap: break-word;
              max-width: 100%;
            }
            .paragraph.chorus {
              font-weight: bold;
              margin-top: 1em;
              margin-bottom: 1em;
              white-space: pre-wrap;
              word-wrap: break-word;
              overflow-wrap: break-word;
              max-width: 100%;
            }
            .paragraph.chorus .lyrics {
              text-transform: uppercase;
            }
            ${
              isFullscreen
                ? `
            .fs-header {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              padding: ${Math.max(s.topPadding - 48, 8)}px 60px 16px 16px;
              background: linear-gradient(to bottom,
                ${c.fsBgTop} 0%,
                ${c.fsBgMid} 72%,
                transparent 100%
              );
              z-index: 10;
              pointer-events: none;
            }
            .fs-title {
              font-size: 0.9em;
              font-weight: 700;
              color: ${c.titleText};
              line-height: 1.25;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              margin-bottom: 3px;
              opacity: 0.88;
            }
            .fs-meta {
              display: flex;
              align-items: center;
              flex-wrap: wrap;
              gap: 4px;
            }
            .fs-author {
              font-size: 0.7em;
              color: ${c.authorText};
              font-style: italic;
            }
            .fs-sep {
              font-size: 0.65em;
              color: ${c.authorText};
              opacity: 0.45;
              margin: 0 1px;
            }
            .fs-badge-sm {
              font-size: 0.65em;
              font-weight: 600;
              color: ${c.badgeText};
              background: ${c.badgeBg};
              padding: 1px 6px;
              border-radius: 8px;
              letter-spacing: 0.01em;
            }
            .fs-badge-accent {
              color: ${c.badgeAccentText};
              background: ${c.badgeAccentBg};
            }`
                : ''
            }
          </style>
        </head>
        <body class="${s.isDark ? 'theme-dark' : ''}${s.chordsVisible ? '' : ' chords-hidden'}${s.arrangementsVisible ? '' : ' arr-hidden'}">
          ${fsHeader}
          ${finalSongContentWithMeta}
          <script>${bootstrap}</script>
        </body>
        </html>
      `;
      finalHtml = convertHtmlChords(finalHtml, notation);
      setSongHtml(finalHtml);
    } catch (err) {
      logger.error('Error procesando canción en useSongProcessor:', err);
      setSongHtml(
        buildErrorHtml(
          songError,
          styleRef.current.isDark,
          styleRef.current.fontFamily,
        ),
      );
    } finally {
      setIsLoadingSong(false);
    }
    // Structural-only deps. Style-only changes (fontSize, fontFamily, isDark,
    // chordsVisible, top/bottomInset) are picked up by `styleRef` for the next
    // structural rebuild but do NOT trigger a rebuild on their own — the
    // WebView updates them live via postMessage.
  }, [
    originalChordPro,
    baseSong,
    songError,
    currentTranspose,
    notation,
    title,
    author,
    key,
    capo,
    isFullscreen,
    adminMode,
  ]);

  return { songHtml, isLoadingSong, styleState, songError };
};

import { logger } from '@/utils/logger';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { Notation } from '../utils/chordNotation';
import type { ChorusStyle } from '../utils/songSheetLayout';
import {
  buildErrorHtml,
  buildSongDocument,
  NO_SHEET_INFO,
  parseChordPro,
  type ParsedResult,
  type SongParseError,
  type SongSheetInfo,
  type SongStyleState,
} from '../utils/songDocument';

export type { SongParseError, SongSheetInfo, SongStyleState };

export interface UseSongProcessorParams {
  originalChordPro: string | null;
  currentTranspose: number;
  chordsVisible: boolean;
  /** Mostrar anotaciones de arreglo `{arr:}`. Default true. */
  arrangementsVisible?: boolean;
  /**
   * Vista compacta: los estribillos que se repiten se pliegan en una línea
   * («Estribillo ×2»), que se despliega al tocarla. Default false.
   */
  compact?: boolean;
  /** Números de estrofa. Default true. */
  verseNumbers?: boolean;
  /** Variante del estribillo. Default 'negrita' (raya + negrita). */
  chorusStyle?: ChorusStyle;
  /** Etiqueta «ESTRIBILLO». Default true. */
  chorusLabel?: boolean;
  /** Más hueco entre líneas y bloques. Default false. */
  airy?: boolean;
  /**
   * Pantalla completa en páginas (modo atril): sin scroll, se pasa de página
   * con un toque en el borde o con un pedal. Default false.
   */
  paged?: boolean;
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
  compact = false,
  verseNumbers = true,
  chorusStyle = 'negrita',
  chorusLabel = true,
  airy = false,
  paged = false,
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
  const [sheetInfo, setSheetInfo] = useState<SongSheetInfo>(NO_SHEET_INFO);

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
      compact,
      verseNumbers,
      chorusStyle,
      chorusLabel,
      airy,
      paged,
      topPadding,
      bottomPadding,
    }),
    [
      currentFontSizeEm,
      currentFontFamily,
      isDark,
      chordsVisible,
      arrangementsVisible,
      compact,
      verseNumbers,
      chorusStyle,
      chorusLabel,
      airy,
      paged,
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
      setSheetInfo(NO_SHEET_INFO);
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
      const { html, sheetInfo: info } = buildSongDocument(baseSong, {
        style: styleRef.current,
        currentTranspose,
        notation,
        title,
        author,
        key,
        capo,
        isFullscreen,
        adminMode,
      });
      setSheetInfo(info);
      setSongHtml(html);
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

  return { songHtml, isLoadingSong, styleState, songError, sheetInfo };
};

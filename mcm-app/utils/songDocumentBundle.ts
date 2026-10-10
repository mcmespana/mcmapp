/**
 * Entrada del paquete `mcm-sheet.js` para la vista previa del admin del
 * cantoral (`mcmapp-cantoral/scripts/admin/static/mcm-sheet.js`).
 *
 * Expone `window.MCMSheet.render(chordPro, opciones)` → `{ html, sheetInfo,
 * error }`: el MISMO documento que pinta el WebView de la app, para meterlo
 * en un `<iframe srcdoc>`. Se genera con `npm run build:sheet-bundle`; hay que
 * volver a generarlo (y commitearlo en el cantoral) cuando cambie la hoja:
 * `utils/songSheet*.ts`, `utils/songDocument.ts` o los colores.
 */
import { renderSongDocument, type SongStyleState } from './songDocument';
import { CHORUS_STYLES, type ChorusStyle } from './songSheetLayout';
import { DEFAULT_FONT_SIZE_EM, SONG_FONTS } from '@/constants/songFonts';
import type { Notation } from './chordNotation';

export interface PreviewOptions {
  notation?: Notation;
  transpose?: number;
  chordsVisible?: boolean;
  compact?: boolean;
  verseNumbers?: boolean;
  chorusStyle?: ChorusStyle;
  chorusLabel?: boolean;
  airy?: boolean;
  dark?: boolean;
  fontSize?: number;
  fontFamily?: string;
  /** Lo que la app recibe aparte del cuerpo (campos del JSON). */
  author?: string;
  key?: string;
  capo?: number;
  title?: string;
  /** `data-line` en cada línea (para señalar la línea del .cho). */
  lineNumbers?: boolean;
}

/**
 * Lo que trae la app de serie (`defaultSettings` de `SettingsContext`). Si
 * cambian allí, cámbialos aquí: el test `songDocumentBundle.test.ts` lo vigila.
 */
export const PREVIEW_DEFAULTS = {
  notation: 'ES' as Notation,
  chordsVisible: true,
  compact: false,
  verseNumbers: true,
  chorusStyle: 'negrita' as ChorusStyle,
  chorusLabel: true,
  airy: false,
  fontSize: DEFAULT_FONT_SIZE_EM,
  fontFamily: SONG_FONTS[0].cssValue as string,
};

export function renderPreview(chordPro: string, o: PreviewOptions = {}) {
  const d = PREVIEW_DEFAULTS;
  const style: SongStyleState = {
    fontSize: o.fontSize ?? d.fontSize,
    fontFamily: o.fontFamily ?? d.fontFamily,
    isDark: !!o.dark,
    chordsVisible: o.chordsVisible ?? d.chordsVisible,
    arrangementsVisible: true,
    compact: o.compact ?? d.compact,
    verseNumbers: o.verseNumbers ?? d.verseNumbers,
    chorusStyle: o.chorusStyle ?? d.chorusStyle,
    chorusLabel: o.chorusLabel ?? d.chorusLabel,
    airy: o.airy ?? d.airy,
    paged: false,
    // Los de la app en web (`useSongProcessor`).
    topPadding: 16,
    bottomPadding: 40,
  };
  return renderSongDocument(chordPro, {
    style,
    currentTranspose: o.transpose ?? 0,
    notation: o.notation ?? d.notation,
    title: o.title,
    author: o.author,
    key: o.key,
    capo: o.capo,
    adminMode: !!o.lineNumbers,
  });
}

const api = {
  render: renderPreview,
  defaults: PREVIEW_DEFAULTS,
  fonts: SONG_FONTS,
  chorusStyles: CHORUS_STYLES,
};

(globalThis as { MCMSheet?: typeof api }).MCMSheet = api;

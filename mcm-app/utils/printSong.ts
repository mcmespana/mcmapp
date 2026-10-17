/**
 * Imprimir una canción suelta (web): Cmd/Ctrl+P sobre la pestaña imprime el
 * cascarón de la app y la letra recortada al alto del iframe. Aquí se usa el
 * mismo HTML que el PDF de la playlist (`buildPlaylistPdfHtml`, la hoja de
 * la app en papel) con una sola canción y sin portada, en una ventana nueva.
 */
import { buildPlaylistPdfHtml, type PdfSongInput } from './playlistPdfHtml';
import type { Notation } from './chordNotation';
import type { ChorusStyle } from './songSheetLayout';

export interface PrintSongView {
  notation: Notation;
  showChords: boolean;
  compact?: boolean;
  chorusStyle?: ChorusStyle;
  chorusLabel?: boolean;
  verseNumbers?: boolean;
}

/** Tamaño de la letra en papel: el de serie del PDF de la playlist. */
const PRINT_LYRICS_PT = 13;

/** El HTML imprimible de una canción, tal como se ve en la app. */
export function buildSongPrintHtml(
  song: PdfSongInput,
  view: PrintSongView,
): string {
  return buildPlaylistPdfHtml({
    playlistName: song.title.replace(/^\d+\.\s*/, '').trim() || 'Canción',
    songs: [song],
    notation: view.notation,
    pageBreakPerSong: false,
    showChords: view.showChords,
    lyricsFontPt: PRINT_LYRICS_PT,
    printedDate: '',
    compact: view.compact,
    chorusStyle: view.chorusStyle,
    chorusLabel: view.chorusLabel,
    verseNumbers: view.verseNumbers,
    cover: false,
  });
}

/** Tope de espera a la hoja de estilos y la fuente antes de imprimir. */
const READY_TIMEOUT_MS = 3000;

/**
 * Abre `html` en una ventana nueva y lanza el diálogo de imprimir cuando ha
 * cargado (estilos y fuente), con un tope. Devuelve false si el navegador ha
 * bloqueado la ventana emergente.
 */
export function printHtmlInNewWindow(html: string): boolean {
  if (typeof window === 'undefined') return false;
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  // `load` se engancha antes de `close()`, que es lo que lo dispara
  // (`open()` borra los listeners de la ventana).
  let done = false;
  const print = () => {
    if (done) return;
    done = true;
    try {
      w.focus();
      w.print();
    } catch {
      // Ventana cerrada antes de tiempo: no hay nada que imprimir.
    }
  };
  w.addEventListener('load', () => {
    const fonts = w.document.fonts?.ready;
    if (fonts) fonts.then(print, print);
    else print();
  });
  setTimeout(print, READY_TIMEOUT_MS);
  w.document.close();
  return true;
}

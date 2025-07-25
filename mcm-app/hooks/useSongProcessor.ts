import { useState, useEffect } from 'react';
import {
  ChordProParser,
  HtmlDivFormatter,
  Song,
  ChordLyricsPair,
} from 'chordsheetjs';
import { AppColors } from '../app/styles/theme'; // Ensure this path is correct relative to the hooks folder
import {
  convertHtmlChords,
  convertChord,
  Notation,
} from '../utils/chordNotation';

interface UseSongProcessorParams {
  originalChordPro: string | null;
  currentTranspose: number;
  chordsVisible: boolean;
  currentFontSizeEm: number;
  currentFontFamily: string;
  notation: Notation;
  author?: string; // Added to pass author
  key?: string; // Added to pass key
  capo?: number; // Added to pass capo
}

export const useSongProcessor = ({
  originalChordPro,
  currentTranspose,
  chordsVisible,
  currentFontSizeEm,
  currentFontFamily,
  notation,
  author,
  key,
  capo,
}: UseSongProcessorParams) => {
  const [songHtml, setSongHtml] = useState<string>('Cargando…');
  const [isLoadingSong, setIsLoadingSong] = useState<boolean>(true);

  useEffect(() => {
    if (!originalChordPro) {
      // setSongHtml('Esperando contenido de la canción...'); // Or some other placeholder
      setIsLoadingSong(false); // Not necessarily loading if there's no content to process
      return;
    }

    setIsLoadingSong(true);
    try {
      let processedChordPro = originalChordPro;

      processedChordPro = processedChordPro
        .replace(/\{sov\}/gi, '{start_of_verse}')
        .replace(/\{eov\}/gi, '{end_of_verse}')
        .replace(/\{soc\}/gi, '{start_of_chorus}')
        .replace(/\{eoc\}/gi, '{end_of_chorus}')
        .replace(/\{sob\}/gi, '{start_of_bridge}')
        .replace(/\{eob\}/gi, '{end_of_bridge}');
      processedChordPro = processedChordPro.replace(
        /\{transpose:.*\}\n?/gi,
        '',
      );

      if (currentTranspose !== 0) {
        const chordProValueForDirective =
          currentTranspose < 0 ? currentTranspose + 12 : currentTranspose;
        if (chordProValueForDirective !== 0) {
          processedChordPro = `{transpose: ${chordProValueForDirective}}\n${processedChordPro}`;
        }
      }

      const fontSizeCss = `
        .chord-sheet .lyrics, .chord-sheet .chord {
          font-size: ${currentFontSizeEm}em !important;
        }
      `;

      const parser = new ChordProParser();
      const originalParsedSong = parser.parse(processedChordPro);

      let songForFormatting: Song = originalParsedSong;

      const formatter = new HtmlDivFormatter();
      let formattedSong = formatter.format(songForFormatting);

      let metaInsert = '';
      if (author) {
        metaInsert += `<div class="song-meta-author">${author}</div>`;
      }
      let finalKeyCapoString = '';
      let displayKey = key ? key.toUpperCase() : '';

      // If there's a transpose value, we need to find the new key for display purposes.
      // This is a simplified way; chordsheetjs's internal transposition is more robust.
      // We parse a minimal song with the original key and transpose it.
      if (key && currentTranspose !== 0) {
        try {
          const tempSongForKey = new ChordProParser().parse(
            `{key: ${key}}\n[${key}]`,
          );
          const transposedTempSong = tempSongForKey.transpose(currentTranspose);
          if (
            transposedTempSong.lines.length > 0 &&
            transposedTempSong.lines[0].items.length > 0
          ) {
            const firstItem = transposedTempSong.lines[0].items[0];
            if (firstItem instanceof ChordLyricsPair && firstItem.chords) {
              displayKey = firstItem.chords.toUpperCase();
            }
          }
        } catch (e) {
          console.warn('Could not calculate transposed key for display:', e);
          // displayKey remains original key if transposition calculation fails
        }
      }

      if (displayKey) {
        finalKeyCapoString += `<strong>${convertChord(displayKey, notation)}</strong>`;
      }

      if (capo !== undefined && capo > 0) {
        if (finalKeyCapoString) finalKeyCapoString += ' - ';
        finalKeyCapoString += `Cejilla ${capo}`;
      }

      if (currentTranspose !== 0) {
        if (finalKeyCapoString) finalKeyCapoString += ' | ';
        const transposeDisplay =
          currentTranspose > 0 ? `+${currentTranspose}` : `${currentTranspose}`;
        finalKeyCapoString += `<strong>Semitonos: ${transposeDisplay}</strong>`;
      }

      if (finalKeyCapoString) {
        metaInsert += `<div class="song-meta-keycapo">${finalKeyCapoString}</div>`;
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

      const chordsCss = chordsVisible
        ? ''
        : '<style>.chord { display: none !important; }</style>';

      let finalHtml = `
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
          <style>
            body {
              font-family: ${currentFontFamily};
              margin: 0px;
              background-color: #ffffff;
              color: ${AppColors.textDark || '#212529'};
              font-size: 100%;
              max-width: 100%;
              overflow-wrap: break-word;
              word-wrap: break-word;
            }
            h1 {
              color: #333;
              margin-bottom: 0.2em;
              font-size: 1.6em;
              text-align: center;
            }
            .song-meta-author {
              color: #777;
              font-size: 0.9em;
              margin-bottom: 5px;
              font-style: italic;
              text-align: center;
            }
            .song-meta-keycapo {
              color: #555;
              font-size: 0.9em;
              margin-bottom: 10px;
              text-align: center;
            }
            .song-meta-keycapo strong {
              font-weight: bold;
            }
            .chord-sheet {
              margin-top: 1em;
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
              color: ${AppColors.primary};
              font-weight: bold;
              white-space: pre;
              display: block;
              min-height: 1.2em;
            }
            .chord-sheet .lyrics {
              white-space: pre-wrap;
              word-wrap: break-word;
              overflow-wrap: break-word;
              display: block;
              min-height: 1.2em;
              max-width: 100%;
            }
            .comment, .c {
              color: ${AppColors.secondaryText};
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
              margin-top: 1.75em;
              margin-bottom: 1.75em;
              white-space: pre-wrap;
              word-wrap: break-word;
              overflow-wrap: break-word;
              max-width: 100%;
            }
            .paragraph.chorus {
              font-weight: bold;
              margin-top: 1.2em;
              margin-bottom: 1.2em;
              white-space: pre-wrap;
              word-wrap: break-word;
              overflow-wrap: break-word;
              max-width: 100%;
            }
            ${fontSizeCss}
          </style>
          ${chordsCss}
        </head>
        <body>
          ${finalSongContentWithMeta}
        </body>
        </html>
      `;
      finalHtml = convertHtmlChords(finalHtml, notation);
      setSongHtml(finalHtml);
    } catch (err) {
      console.error('Error procesando canción en useSongProcessor:', err);
      setSongHtml('❌ Error preparando la canción.');
    } finally {
      setIsLoadingSong(false);
    }
  }, [
    originalChordPro,
    currentTranspose,
    chordsVisible,
    currentFontSizeEm,
    currentFontFamily,
    notation,
    author,
    key,
    capo,
  ]);

  return { songHtml, isLoadingSong };
};

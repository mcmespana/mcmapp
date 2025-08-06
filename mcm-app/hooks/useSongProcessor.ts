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
  isFullscreen?: boolean; // Added for fullscreen mode
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
  isFullscreen = false,
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
      if (author && !isFullscreen) {
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
        finalKeyCapoString += `<strong>Cejilla ${capo}</strong>`;
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
              padding: 4px 6px;
              background-color: #ffffff;
              color: ${AppColors.textDark || '#212529'};
              font-size: 100%;
              max-width: 100%;
              overflow-wrap: break-word;
              word-wrap: break-word;
              box-sizing: border-box;
            }
            h1 {
              color: ${AppColors.primary || '#007bff'};
              margin-bottom: 0.1em;
              margin-top: 0.1em;
              font-size: 1.5em;
              font-weight: 600;
              text-align: center;
              line-height: 1.2;
              padding-bottom: 4px;
              border-bottom: 1px solid ${AppColors.accentYellow || '#ffc107'};
              ${isFullscreen ? 'display: none;' : ''}
            }
            .song-meta-author {
              color: #666;
              font-size: 0.85em;
              margin-bottom: 4px;
              font-style: italic;
              font-weight: 400;
              text-align: center;
            }
            .song-meta-keycapo {
              color: #555;
              font-size: 0.85em;
              font-weight: 500;
              margin-bottom: 8px;
              text-align: center;
              background-color: #f0f1f2;
              padding: 6px 10px;
              border-radius: 4px;
              border-left: 2px solid ${AppColors.primary || '#007bff'};
            }
            .song-meta-keycapo strong {
              font-weight: 600;
              color: ${AppColors.primary || '#007bff'};
            }
            .chord-sheet {
              margin-top: 0.8em;
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

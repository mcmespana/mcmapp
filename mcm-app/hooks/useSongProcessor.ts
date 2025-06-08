import { useState, useEffect } from 'react';
import { ChordProParser, HtmlDivFormatter, Song, Line, ChordLyricsPair } from 'chordsheetjs';
import { AppColors } from '../app/styles/theme'; // Ensure this path is correct relative to the hooks folder

// Map of single note names used for translation
const NOTE_MAP: Record<string, string> = {
  'C': 'DO',
  'D': 'RE',
  'E': 'MI',
  'F': 'FA',
  'G': 'SOL',
  'A': 'LA',
  'B': 'SI',
};

// Generic chord translator that keeps suffixes (m, 7, etc.) and supports slash chords
const translateChordToSpanish = (chord: string): string => {
  return chord
    .split('/')
    .map(part => {
      const match = part.match(/^([A-G])([#b]?)(.*)$/);
      if (!match) return part;
      const [, root, accidental, rest] = match;
      const translatedRoot = NOTE_MAP[root] || root;
      return `${translatedRoot}${accidental || ''}${rest}`;
    })
    .join('/');
};

interface UseSongProcessorParams {
  originalChordPro: string | null;
  currentTranspose: number;
  chordsVisible: boolean;
  currentFontSizeEm: number;
  currentFontFamily: string;
  author?: string; // Added to pass author
  key?: string; // Added to pass key
  capo?: number; // Added to pass capo
  notation?: 'english' | 'spanish'; // Added for notation preference
}

export const useSongProcessor = ({
  originalChordPro,
  currentTranspose,
  chordsVisible,
  currentFontSizeEm,
  currentFontFamily,
  author,
  key,
  capo,
  notation = 'english', // Default to English
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

      processedChordPro = processedChordPro.replace(/\{sov\}/gi, '{start_of_verse}')
                                     .replace(/\{eov\}/gi, '{end_of_verse}')
                                     .replace(/\{soc\}/gi, '{start_of_chorus}')
                                     .replace(/\{eoc\}/gi, '{end_of_chorus}')
                                     .replace(/\{sob\}/gi, '{start_of_bridge}')
                                     .replace(/\{eob\}/gi, '{end_of_bridge}');
      processedChordPro = processedChordPro.replace(/\{transpose:.*\}\n?/gi, '');

      if (currentTranspose !== 0) {
        const chordProValueForDirective = currentTranspose < 0 ? currentTranspose + 12 : currentTranspose;
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

      // Apply notation translation if needed, after transposition (which is handled by ChordProParser with {transpose} directive)
      if (notation === 'spanish') {
        songForFormatting.lines = songForFormatting.lines.map(line => {
          const newLine = new Line();
          newLine.items = line.items.map(item => {
            if (item instanceof ChordLyricsPair) {
              const chordsToTranslate = item.chords;
              if (chordsToTranslate && chordsToTranslate.trim() !== '') {
                const translatedChordsString = chordsToTranslate
                  .split(/(\s+)/) // Split by whitespace, keeping delimiters
                  .map(part => {
                    if (part.match(/^\s+$/)) return part; // keep whitespace
                    return translateChordToSpanish(part);
                  })
                  .join('');

                try {
                  return new ChordLyricsPair(
                    translatedChordsString,
                    item.lyrics || '',
                    item.annotation || undefined
                  );
                } catch (e) {
                  console.error('Error creating new ChordLyricsPair with chords:', translatedChordsString, e);
                  return item; // Fallback to original item on error
                }
              }
            }
            return item; // For other item types or items without chords, return them as is
          });
          return newLine;
        });
      }

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
          const tempSongForKey = new ChordProParser().parse(`{key: ${key}}\n[${key}]`);
          const transposedTempSong = tempSongForKey.transpose(currentTranspose);
          if (transposedTempSong.lines.length > 0 && transposedTempSong.lines[0].items.length > 0) {
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

      if (notation === 'spanish' && displayKey) {
        displayKey = translateChordToSpanish(displayKey);
      }

      if (displayKey) {
        finalKeyCapoString += `<strong>${displayKey}</strong>`;
      }

      if (capo !== undefined && capo > 0) {
        if (finalKeyCapoString) finalKeyCapoString += ' - ';
        finalKeyCapoString += `Cejilla ${capo}`;
      }

      if (currentTranspose !== 0) {
        if (finalKeyCapoString) finalKeyCapoString += ' | ';
        const transposeDisplay = currentTranspose > 0 ? `+${currentTranspose}` : `${currentTranspose}`;
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

      const chordsCss = chordsVisible ? '' : '<style>.chord { display: none !important; }</style>';

      const finalHtml = `
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
          <style>
            body {
              font-family: ${currentFontFamily};
              margin: 10px;
              background-color: #ffffff;
              color: ${AppColors.textDark || '#212529'};
              font-size: 100%;
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
            }
            .row {
              display: flex;
              flex-wrap: wrap;
              margin-bottom: 0.2em;
            }
            .column {
              padding-right: 0;
            }
            .chord-sheet .chord {
              color: ${AppColors.primary};
              font-weight: bold;
              white-space: pre;
              display: block;
              min-height: 1.2em;
            }
            .chord-sheet .lyrics {
              white-space: pre;
              display: block;
              min-height: 1.2em;
            }
            .comment, .c {
              color: ${AppColors.secondaryText};
              font-style: italic;
              white-space: pre;
              display: block;
              margin-top: 0.5em;
              margin-bottom: 0.5em;
            }
            .paragraph {
              margin-top: 1.75em;
              margin-bottom: 1.75em;
            }
            .paragraph.chorus {
              font-weight: bold;
              margin-top: 1.2em;
              margin-bottom: 1.2em;
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
      setSongHtml(finalHtml);
    } catch (err) {
      console.error('Error procesando canción en useSongProcessor:', err);
      setSongHtml('❌ Error preparando la canción.');
    } finally {
      setIsLoadingSong(false);
    }
  }, [originalChordPro, currentTranspose, chordsVisible, currentFontSizeEm, currentFontFamily, author, key, capo, notation]);

  return { songHtml, isLoadingSong };
};

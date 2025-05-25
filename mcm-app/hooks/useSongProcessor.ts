import { useState, useEffect } from 'react';
import { ChordProParser, HtmlDivFormatter, Song, Line, ChordLyricsPair } from 'chordsheetjs';
import { AppColors } from '../app/styles/theme'; // Ensure this path is correct relative to the hooks folder

// Placeholder dictionary for English to Spanish chord translation
// USER: Please expand this dictionary with all common chords and their variations (m, 7, maj7, sus, dim, aug, #, b, slash chords like G/B, etc.)
// Example: 'C': 'DO', 'Am': 'LAm', 'G/B': 'SOL/SI', 'C#m7': 'DO#m7'
const ENGLISH_TO_SPANISH_CHORDS: { [key: string]: string } = {
  'C': 'DO', 'D': 'RE', 'E': 'MI', 'F': 'FA', 'G': 'SOL', 'A': 'LA', 'B': 'SI',
  'Cm': 'DOm', 'Dm': 'REm', 'Em': 'MIm', 'Fm': 'FAm', 'Gm': 'SOLm', 'Am': 'LAm', 'Bm': 'SIm',
  
  'C#': 'DO#', 'Db': 'REb',
  'D#': 'RE#', 'Eb': 'MIb',
  'F#': 'FA#', 'Gb': 'SOLb',
  'G#': 'SOL#', 'Ab': 'LAb', // LAb is more common than SOL#b for Ab in Spanish
  'A#': 'LA#', 'Bb': 'SIb',

  'C#m': 'DO#m', 'Dbm': 'REbm',
  'D#m': 'RE#m', 'Ebm': 'MIbm',
  'F#m': 'FA#m', 'Gbm': 'SOLbm',
  'G#m': 'SOL#m', 'Abm': 'LAbm',
  'A#m': 'LA#m', 'Bbm': 'SIbm',

  // Add 7ths (dominant)
  'C7': 'DO7', 'D7': 'RE7', 'E7': 'MI7', 'F7': 'FA7', 'G7': 'SOL7', 'A7': 'LA7', 'B7': 'SI7',
  'C#7': 'DO#7', 'Db7': 'REb7', 
  'D#7': 'RE#7', 'Eb7': 'MIb7',
  'F#7': 'FA#7', 'Gb7': 'SOLb7',
  'G#7': 'SOL#7', 'Ab7': 'LAb7',
  'A#7': 'LA#7', 'Bb7': 'SIb7',

  // Add minor 7ths
  'Cm7': 'DOm7', 'Dm7': 'REm7', 'Em7': 'MIm7', 'Fm7': 'FAm7', 'Gm7': 'SOLm7', 'Am7': 'LAm7', 'Bm7': 'SIm7',
  // ... and so on for all sharp/flat minor 7ths ...

  // Add major 7ths
  'Cmaj7': 'DOmaj7', 'Dmaj7': 'REmaj7', 'Emaj7': 'MImáj7', 'Fmaj7': 'FAmaj7', 'Gmaj7': 'SOLmaj7', 'Amaj7': 'LAmaj7', 'Bmaj7': 'SImáj7',
  // ... and so on for all sharp/flat major 7ths ...

  // Slash chords (examples)
  'G/B': 'SOL/SI', 
  'C/E': 'DO/MI',
  'Am/G': 'LAm/SOL',

  // Sus chords (examples)
  'Dsus4': 'REsus4', 'Gsus': 'SOLsus', 'Asus4': 'LAsus4',
  // User should continue populating this dictionary extensively.
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
                    if (part.match(/^\s+$/)) return part; // if it's whitespace, keep it
                    // Ensure we handle cases like 'Am/G' - only translate the main chord part if needed
                    // This basic dictionary won't handle complex chords like 'Am/G' correctly for translation yet.
                    // For now, it translates whole chord names found in the dictionary.
                    return ENGLISH_TO_SPANISH_CHORDS[part] || part;
                  })
                  .join('');

                // Reconstruct the ChordPro segment string, e.g., "[Lam]Lyrics"
                // Ensure lyrics are included. If lyrics are null/empty, it becomes e.g. "[Lam]"
                const newChordProSegment = `[${translatedChordsString}]${item.lyrics || ''}`;
                try {
                  return new ChordLyricsPair(newChordProSegment);
                } catch (e) {
                  console.error('Error creating new ChordLyricsPair with segment:', newChordProSegment, e);
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
        displayKey = ENGLISH_TO_SPANISH_CHORDS[displayKey.replace(/#/g, 's').replace(/b/g, 'f')] || 
                     ENGLISH_TO_SPANISH_CHORDS[displayKey] || 
                     displayKey; // Attempt to translate (basic sharp/flat to common Spanish, then direct)
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
              color: ${AppColors.textDark};
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

import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import {
  ChordProParser,
  HtmlDivFormatter,
  Song,
  ChordLyricsPair,
} from 'chordsheetjs';
import { UIColors } from '@/constants/colors';
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
}

export const useSongProcessor = ({
  originalChordPro,
  currentTranspose,
  chordsVisible,
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
}: UseSongProcessorParams) => {
  const [songHtml, setSongHtml] = useState<string>('Cargando…');
  const [isLoadingSong, setIsLoadingSong] = useState<boolean>(true);

  useEffect(() => {
    if (!originalChordPro) {
      setIsLoadingSong(false);
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

      const songForFormatting: Song = originalParsedSong;

      const formatter = new HtmlDivFormatter();
      const formattedSong = formatter.format(songForFormatting);

      let metaInsert = '';
      if (author && !isFullscreen) {
        metaInsert += `<div class="song-meta-author">${author}</div>`;
      }

      let displayKey = key ? key.toUpperCase() : '';

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
        }
      }

      let badges = '';
      if (displayKey) {
        badges += `<span class="meta-badge">${convertChord(displayKey, notation)}</span>`;
      }
      if (capo !== undefined && capo > 0) {
        badges += `<span class="meta-badge">Cejilla ${capo}</span>`;
      }
      if (currentTranspose !== 0) {
        const transposeDisplay =
          currentTranspose > 0 ? `+${currentTranspose}` : `${currentTranspose}`;
        badges += `<span class="meta-badge meta-badge-accent">${transposeDisplay} semitonos</span>`;
      }
      // Badges below title in normal mode; in fullscreen they go in the fixed header
      if (badges && !isFullscreen) {
        metaInsert += `<div class="song-meta-keycapo">${badges}</div>`;
      }

      // Fixed overlay header for fullscreen: title + compact meta line
      let fsHeader = '';
      if (isFullscreen) {
        let fsMeta = '';
        if (author) fsMeta += `<span class="fs-author">${author}</span>`;
        if (displayKey) {
          if (fsMeta) fsMeta += `<span class="fs-sep">·</span>`;
          fsMeta += `<span class="fs-badge-sm">${convertChord(displayKey, notation)}</span>`;
        }
        if (capo !== undefined && capo > 0) {
          fsMeta += `<span class="fs-badge-sm">Cejilla ${capo}</span>`;
        }
        if (currentTranspose !== 0) {
          const td =
            currentTranspose > 0 ? `+${currentTranspose}` : `${currentTranspose}`;
          fsMeta += `<span class="fs-badge-sm fs-badge-accent">${td} semitonos</span>`;
        }
        fsHeader = `<div class="fs-header">${title ? `<div class="fs-title">${title}</div>` : ''}${fsMeta ? `<div class="fs-meta">${fsMeta}</div>` : ''}</div>`;
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

      // Platform-aware bottom padding.
      // En fullscreen reservamos espacio para el botón de play translúcido
      // y el safe-area inferior (home indicator en iOS). En detalle, espacio
      // suficiente para que el FAB no tape la última línea.
      const bottomPadding =
        bottomInset !== undefined
          ? bottomInset
          : isFullscreen
            ? 110
            : Platform.OS === 'ios'
              ? 120
              : Platform.OS === 'web'
                ? 40
                : 80;
      // Padding superior: en fullscreen, espacio para el close button y notch.
      const topPadding =
        topInset !== undefined ? topInset : isFullscreen ? 72 : 16;

      // Dark mode aware colors
      const c = {
        bodyBg: isDark ? '#2C2C2E' : '#ffffff',
        bodyText: isDark ? '#E5E5EA' : '#212529',
        titleText: isDark ? '#F5F5F7' : '#1C1C1E',
        authorText: isDark ? '#98989D' : '#8E8E93',
        chordColor: isDark ? '#64B5F6' : UIColors.activePrimary,
        commentText: isDark ? '#98989D' : UIColors.secondaryText,
        badgeBg: isDark
          ? 'rgba(244, 193, 30, 0.12)'
          : 'rgba(37, 56, 131, 0.06)',
        badgeText: isDark ? '#F4C11E' : '#253883',
        badgeAccentBg: isDark
          ? 'rgba(225, 92, 98, 0.15)'
          : 'rgba(225, 92, 98, 0.08)',
        badgeAccentText: isDark ? '#FF8A80' : '#C62828',
      };

      let finalHtml = `
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: ${currentFontFamily};
              margin: 0;
              padding: ${topPadding}px 16px ${bottomPadding}px 16px;
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
            }
            body::-webkit-scrollbar { width: 0; height: 0; }
            h1 {
              color: ${c.titleText};
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
              color: ${c.authorText};
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
              background: ${c.badgeBg};
              color: ${c.badgeText};
              padding: 4px 12px;
              border-radius: 16px;
              font-size: 0.78em;
              font-weight: 600;
              letter-spacing: 0.02em;
            }
            .meta-badge-accent {
              background: ${c.badgeAccentBg};
              color: ${c.badgeAccentText};
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
              color: ${c.chordColor};
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
              color: ${c.commentText};
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
              padding: ${Math.max(topPadding - 48, 8)}px 60px 16px 16px;
              background: linear-gradient(to bottom,
                ${isDark ? 'rgba(44,44,46,0.97)' : 'rgba(255,255,255,0.97)'} 0%,
                ${isDark ? 'rgba(44,44,46,0.88)' : 'rgba(255,255,255,0.88)'} 72%,
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
            ${fontSizeCss}
          </style>
          ${chordsCss}
        </head>
        <body>
          ${fsHeader}
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
    title,
    author,
    key,
    capo,
    isDark,
    isFullscreen,
    topInset,
    bottomInset,
  ]);

  return { songHtml, isLoadingSong };
};

/**
 * Imprimir una canción suelta (web): la misma hoja que el PDF de la playlist,
 * sin portada ni índice, con el tono y la vista que se tienen en pantalla.
 */
import { buildPlaylistPdfHtml } from '@/utils/playlistPdfHtml';
import { buildSongPrintHtml, printHtmlInNewWindow } from '@/utils/printSong';

const SONG = {
  title: '18. Alegre la mañana',
  author: 'Kiko',
  key: 'C',
  content: '[C]Alegre la ma[G]ñana',
  transpose: 2,
};

describe('buildSongPrintHtml', () => {
  const html = buildSongPrintHtml(SONG, { notation: 'EN', showChords: true });

  it('sin portada: empieza por la canción', () => {
    expect(html).not.toContain('class="cover"');
    expect(html).toContain('<article');
  });

  it('el pie sale ya en la primera página, con el título sin número', () => {
    expect(html).not.toMatch(/@page :first/);
    expect(html).toContain('content: "Alegre la mañana"');
    expect(html).toContain('<title>Alegre la mañana</title>');
  });

  it('en el tono que se ve en pantalla', () => {
    expect(html).toContain('>D<');
  });

  it('sin acordes, como en pantalla', () => {
    const lyrics = buildSongPrintHtml(SONG, {
      notation: 'EN',
      showChords: false,
    });
    expect(lyrics).toMatch(/<body class="[^"]*chords-hidden/);
  });

  it('el PDF de la playlist sigue con su portada', () => {
    const pdf = buildPlaylistPdfHtml({
      playlistName: 'Ensayo',
      songs: [SONG],
      notation: 'EN',
      pageBreakPerSong: false,
      showChords: true,
      lyricsFontPt: 13,
      printedDate: '',
    });
    expect(pdf).toContain('class="cover"');
    expect(pdf).toMatch(/@page :first/);
  });
});

describe('printHtmlInNewWindow', () => {
  const realOpen = window.open;
  afterEach(() => {
    window.open = realOpen;
    jest.useRealTimers();
  });

  it('con la ventana emergente bloqueada, avisa (false)', () => {
    window.open = jest.fn(() => null);
    expect(printHtmlInNewWindow('<p>x</p>')).toBe(false);
  });

  it('escribe la hoja e imprime una sola vez al cargar', async () => {
    jest.useFakeTimers();
    let onLoad: () => void = () => {};
    const w = {
      document: {
        open: jest.fn(),
        write: jest.fn(),
        close: jest.fn(() => onLoad()),
        fonts: { ready: Promise.resolve() },
      },
      addEventListener: (_: string, cb: () => void) => {
        onLoad = cb;
      },
      focus: jest.fn(),
      print: jest.fn(),
    };
    window.open = jest.fn(() => w as unknown as Window);
    expect(printHtmlInNewWindow('<p>x</p>')).toBe(true);
    expect(w.document.write).toHaveBeenCalledWith('<p>x</p>');
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(5000);
    expect(w.print).toHaveBeenCalledTimes(1);
  });
});

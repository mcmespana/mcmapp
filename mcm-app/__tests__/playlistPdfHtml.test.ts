import {
  buildPlaylistPdfHtml,
  estimateSongHeightPt,
} from '@/utils/playlistPdfHtml';
import { parseChordPro } from '@/utils/songDocument';
import { buildSheet } from '@/utils/songSheet';

const baseOpts = {
  playlistName: 'Misa joven',
  songs: [
    {
      title: '01. Alaba a tu Señor',
      author: 'MCM',
      key: 'C',
      content: '{title: Alaba}\n[C]Alaba a tu Se[G]ñor',
    },
  ],
  notation: 'ES' as const,
  pageBreakPerSong: false,
  showChords: true,
  lyricsFontPt: 13,
};

describe('buildPlaylistPdfHtml — fecha impresa', () => {
  it('usa la fecha personalizada cuando se pasa printedDate', () => {
    const html = buildPlaylistPdfHtml({
      ...baseOpts,
      printedDate: 'Domingo 14 de junio',
    });
    expect(html).toContain('Domingo 14 de junio');
  });

  it('omite la fecha de la portada cuando printedDate es vacío', () => {
    const html = buildPlaylistPdfHtml({ ...baseOpts, printedDate: '' });
    expect(html).toContain('1 canción');
    expect(html).not.toContain('1 canción ·');
  });

  it('usa la fecha de hoy cuando no se pasa printedDate', () => {
    const html = buildPlaylistPdfHtml(baseOpts);
    const year = String(new Date().getFullYear());
    expect(html).toContain(year);
  });
});

describe('buildPlaylistPdfHtml — pie de página', () => {
  it('incluye numeración y nombre de playlist en los margin boxes de @page', () => {
    const html = buildPlaylistPdfHtml(baseOpts);
    expect(html).toContain('counter(page)');
    expect(html).toContain('@bottom-right');
    expect(html).toContain('@bottom-left');
    expect(html).toContain('"Misa joven"');
  });

  it('escapa comillas del nombre en la cadena CSS del pie', () => {
    const html = buildPlaylistPdfHtml({
      ...baseOpts,
      playlistName: 'Misa "joven"',
    });
    expect(html).toContain('"Misa \\"joven\\""');
  });
});

describe('buildPlaylistPdfHtml — la hoja de la app', () => {
  const song = (content: string, extra = {}) => ({
    ...baseOpts,
    songs: [{ title: 'Canción', key: 'C', content, ...extra }],
  });

  it('pinta el cuerpo con la hoja de la app, no con HtmlDivFormatter', () => {
    const html = buildPlaylistPdfHtml(
      song('[C]Verso uno\n\n{soc}\n[G]Estribillo aquí\n{eoc}'),
    );
    expect(html).toContain('class="sheet"');
    expect(html).toMatch(/class="sec chorus/);
    expect(html).not.toContain('class="paragraph');
    // Acordes en la notación pedida.
    expect(html).toContain('>DO<');
  });

  it('aplica el tono de la playlist a los acordes', () => {
    const html = buildPlaylistPdfHtml(
      song('[C]Alaba a tu Se[G]ñor', { transpose: 2 }),
    );
    expect(html).toContain('>RE<');
    expect(html).toContain('>LA<');
    expect(html).not.toContain('>DO<');
  });

  it('escapa el texto de la canción', () => {
    const html = buildPlaylistPdfHtml(song('[C]Hola <script>x</script>'));
    expect(html).not.toContain('<script>x');
    expect(html).toContain('&lt;script&gt;');
  });

  it('deja los avisos de «revisar acordes» fuera de la letra', () => {
    const html = buildPlaylistPdfHtml(
      song('{c: ♩ REVISAR ACORDES}\n[C]Letra de verdad'),
    );
    expect(html).not.toContain('REVISAR ACORDES');
  });

  it('lleva en el <body> las clases de la hoja según las opciones', () => {
    const plain = buildPlaylistPdfHtml(song('[C]Hola'));
    expect(plain).toContain('<body class="ch-negrita">');
    const all = buildPlaylistPdfHtml({
      ...song('[C]Hola'),
      showChords: false,
      compact: true,
      twoColumns: true,
      chorusStyle: 'raya',
      chorusLabel: false,
      verseNumbers: false,
    });
    expect(all).toContain(
      '<body class="ch-raya ch-nolabel nums-hidden chords-hidden compact cols2">',
    );
  });

  it('una canción más larga que una página no salta de página entera', () => {
    const verse = (n: number) =>
      Array.from(
        { length: 4 },
        (_, i) => `[C]Línea ${n}.${i} de la [G]estrofa`,
      ).join('\n');
    const long = Array.from({ length: 12 }, (_, n) => verse(n)).join('\n\n');
    const html = buildPlaylistPdfHtml({
      ...baseOpts,
      songs: [
        { title: 'Larga', content: long },
        { title: 'Corta', content: verse(0) },
      ],
    });
    expect(html).toContain('class="song long"');
    expect(html.match(/class="song"/g)).toHaveLength(1);
  });
});

describe('estimateSongHeightPt', () => {
  const model = (content: string) => {
    const { song } = parseChordPro(content);
    return buildSheet(song!, { notation: 'ES' });
  };
  const verse = Array.from(
    { length: 4 },
    () => '[C]Una línea [G]normal de canción',
  ).join('\n');
  const o = { lyricsPt: 13, showChords: true };

  it('crece con las estrofas y menguan sin acordes o a dos columnas', () => {
    const one = estimateSongHeightPt(model(verse), o);
    const three = estimateSongHeightPt(
      model([verse, verse, verse].join('\n\n')),
      o,
    );
    expect(three).toBeGreaterThan(one * 2);
    expect(
      estimateSongHeightPt(model(verse), { ...o, showChords: false }),
    ).toBeLessThan(one);
    expect(
      estimateSongHeightPt(model([verse, verse, verse].join('\n\n')), {
        ...o,
        twoColumns: true,
      }),
    ).toBeLessThan(three);
  });

  it('cuenta los renglones de más de una línea larga', () => {
    const short = estimateSongHeightPt(model('[C]Corta'), o);
    const longLine = estimateSongHeightPt(
      model('[C]' + 'palabra '.repeat(40)),
      o,
    );
    expect(longLine).toBeGreaterThan(short);
  });
});

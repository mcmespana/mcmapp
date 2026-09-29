/**
 * PDF de la playlist: lo que se imprime DENTRO de cada canción y en el índice.
 *
 * Nadie revisa el PDF antes de llevarlo a misa: si la transposición no se
 * aplica, si la cejilla que sale no es la de la sesión o si el índice dice un
 * tono y la canción otro, el coro lo descubre tocando. Estos tests blindan el
 * cálculo de tono/cejilla y el escape del HTML (el título lo escribe un
 * usuario y acaba en una WebView de impresión).
 *
 * La fecha y el pie de página ya están en `playlistPdfHtml.test.ts`.
 */
import { buildPlaylistPdfHtml, PdfSongInput } from '@/utils/playlistPdfHtml';

const build = (
  songs: PdfSongInput[],
  over: Partial<Parameters<typeof buildPlaylistPdfHtml>[0]> = {},
) =>
  buildPlaylistPdfHtml({
    playlistName: 'Ensayo',
    songs,
    notation: 'EN',
    pageBreakPerSong: false,
    showChords: true,
    lyricsFontPt: 13,
    printedDate: '',
    ...over,
  });

/** Acordes que acaban pintados en el cuerpo, en orden. */
const bodyChords = (html: string) =>
  [...html.matchAll(/<div class="chord"[^>]*>([^<]*)<\/div>/g)]
    .map((m) => m[1])
    .filter(Boolean);

/** Solo el `<article>` de la canción (sin portada ni índice). */
const article = (html: string) =>
  html.slice(html.indexOf('<article'), html.lastIndexOf('</article>'));

const tocItems = (html: string) =>
  [...html.matchAll(/<div class="cover-toc-item">([\s\S]*?)<\/div>/g)].map(
    (m) => m[1].replace(/\s+/g, ' ').trim(),
  );

describe('buildPlaylistPdfHtml — transposición', () => {
  const song: PdfSongInput = {
    title: 'Canción',
    key: 'C',
    content: '[C]Letra [G]más [Am]letra',
  };

  it('transpone los acordes del cuerpo: si falla, el PDF sale en el tono original', () => {
    const html = build([{ ...song, transpose: 2 }]);
    expect(bodyChords(article(html))).toEqual(['D', 'A', 'Bm']);
  });

  it('una transposición negativa baja el tono (−2 desde C es Bb), no lo sube', () => {
    const html = build([{ ...song, transpose: -2 }]);
    expect(bodyChords(article(html))).toEqual(['Bb', 'F', 'Gm']);
  });

  it('−12 es una octava: los acordes se quedan como estaban', () => {
    const html = build([{ ...song, transpose: -12 }]);
    expect(bodyChords(article(html))).toEqual(['C', 'G', 'Am']);
  });

  it('ignora un {transpose:} escrito dentro del ChordPro para no transponer dos veces', () => {
    const html = build([
      { ...song, content: '{transpose: 5}\n[C]Letra', transpose: 0 },
    ]);
    expect(bodyChords(article(html))).toEqual(['C']);
  });

  it('la cabecera enseña el tono de destino y el original entre paréntesis', () => {
    const html = build([{ ...song, transpose: 2 }]);
    expect(article(html)).toContain('<span class="meta-key">D</span>');
    expect(article(html)).toContain('(orig. C)');
  });

  it('sin transponer no pinta "(orig. …)", que haría pensar que se cambió el tono', () => {
    const html = build([song]);
    expect(article(html)).toContain('<span class="meta-key">C</span>');
    expect(html).not.toContain('orig.');
  });

  it('el índice de la portada dice el mismo tono transpuesto que la canción', () => {
    const html = build([{ ...song, transpose: 2 }]);
    expect(tocItems(html)[0]).toContain('<span class="cover-toc-key">D</span>');
  });

  it('en notación española convierte tanto la cabecera como los acordes del cuerpo', () => {
    const html = build([{ ...song, transpose: 2 }], { notation: 'ES' });
    expect(bodyChords(article(html))).toEqual(['RE', 'LA', 'sim']);
    expect(article(html)).toContain('<span class="meta-key">RE</span>');
    expect(article(html)).toContain('(orig. DO)');
  });
});

describe('buildPlaylistPdfHtml — cejilla', () => {
  const base: PdfSongInput = { title: 'X', key: 'G', content: '[G]a' };

  it('sin override imprime la cejilla original de la canción', () => {
    const html = build([{ ...base, capo: 2 }]);
    expect(article(html)).toContain('Cejilla 2');
    expect(article(html)).not.toContain('orig. 2');
  });

  it('con override distinto imprime la de la sesión y recuerda la original', () => {
    const html = build([{ ...base, capo: 2, capoOverride: 4 }]);
    expect(article(html)).toContain('Cejilla 4');
    expect(article(html)).toContain('(orig. 2)');
  });

  it('override 0 quita la cejilla aunque la canción tenga una (el coro decidió tocar sin)', () => {
    const html = build([{ ...base, capo: 3, capoOverride: 0 }]);
    expect(html).not.toContain('Cejilla');
    expect(tocItems(html)[0]).not.toContain('C3');
  });

  it('override null significa "usar la original", no "sin cejilla"', () => {
    const html = build([{ ...base, capo: 3, capoOverride: null }]);
    expect(article(html)).toContain('Cejilla 3');
  });

  it('override igual a la original no añade el "(orig.)" redundante', () => {
    const html = build([{ ...base, capo: 3, capoOverride: 3 }]);
    expect(article(html)).toContain('Cejilla 3');
    expect(article(html)).not.toContain('orig.');
  });

  it('el índice marca con ✱ la cejilla cambiada en esta sesión', () => {
    const html = build([
      { ...base, capo: 2, capoOverride: 5 },
      { ...base, title: 'Y', capo: 2 },
    ]);
    const [first, second] = tocItems(html);
    expect(first).toContain('G · C5✱');
    expect(second).toContain('G · C2');
    expect(second).not.toContain('✱');
  });
});

describe('buildPlaylistPdfHtml — contenido y escape', () => {
  it('quita el número de orden del título ("12. ") en la cabecera y en el índice', () => {
    const html = build([{ title: '12. Pescador de hombres', content: 'a' }]);
    expect(article(html)).toContain(
      '<h2 class="song-title">Pescador de hombres</h2>',
    );
    expect(tocItems(html)[0]).toContain(
      '<span class="cover-toc-title">Pescador de hombres</span>',
    );
  });

  it('escapa HTML en título, autor y nombre de playlist (acaban en la WebView de impresión)', () => {
    const html = build(
      [{ title: '<img src=x onerror=alert(1)>', author: 'A & "B"' }],
      { playlistName: '<b>Misa</b>' },
    );
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('A &amp; &quot;B&quot;');
    expect(html).toContain('&lt;b&gt;Misa&lt;/b&gt;');
  });

  it('una canción sin letra no revienta el PDF: sale un aviso en su lugar', () => {
    const html = build([{ title: 'Vacía', content: '   \n ' }]);
    expect(article(html)).toContain('Sin contenido.');
  });

  it('no repite el título del {title:} del ChordPro dentro del cuerpo', () => {
    const html = build([
      { title: 'Cabecera', content: '{title: Duplicado}\n[C]letra' },
    ]);
    expect(html).not.toContain('Duplicado');
  });

  it('"solo letra" marca el cuerpo con no-chords para que el CSS oculte los acordes', () => {
    const html = build([{ title: 'X', content: '[C]a' }], {
      showChords: false,
    });
    expect(article(html)).toContain('class="song-body no-chords"');
  });

  it('"una canción por página" añade el salto a cada canción', () => {
    const html = build(
      [
        { title: 'A', content: 'a' },
        { title: 'B', content: 'b' },
      ],
      { pageBreakPerSong: true },
    );
    expect(html.match(/<article class="song page-break-after">/g)).toHaveLength(
      2,
    );
  });

  it('pluraliza el contador de la portada', () => {
    const html = build([
      { title: 'A', content: 'a' },
      { title: 'B', content: 'b' },
    ]);
    expect(html).toContain('<div class="cover-meta">2 canciones</div>');
  });

  it('limita el tamaño de letra a 10–18pt aunque llegue un valor fuera de rango', () => {
    const big = build([{ title: 'A', content: 'a' }], { lyricsFontPt: 40 });
    const small = build([{ title: 'A', content: 'a' }], { lyricsFontPt: 2 });
    expect(big).toContain('font-size: 18pt');
    expect(big).not.toContain('font-size: 40pt');
    expect(small).toContain('font-size: 10pt');
  });
});

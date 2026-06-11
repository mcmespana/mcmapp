import { buildPlaylistPdfHtml } from '@/utils/playlistPdfHtml';

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

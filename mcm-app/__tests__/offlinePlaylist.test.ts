import {
  encodeOfflinePlaylist,
  decodeOfflinePlaylist,
  parseSongNumber,
  CATEGORY_CODES,
  type SongInfoResolver,
  type FilenameResolver,
} from '@/utils/offlinePlaylist';
import type { SelectedSong } from '@/contexts/SelectedSongsContext';

// Catálogo de prueba: filename → categoría + número.
const CATALOG: Record<string, { categoryKey: string; number: number }> = {
  'cancion-entrada_05.html': { categoryKey: 'entrada', number: 5 },
  'cancion-adoracion_42.html': { categoryKey: 'adoracion', number: 42 },
  'cancion-comunion_01.html': { categoryKey: 'comunion', number: 1 },
  'rara-sin-categoria_03.html': { categoryKey: 'desconocida', number: 3 },
};

const resolveInfo: SongInfoResolver = (filename) => CATALOG[filename] ?? null;

const filenameResolver: FilenameResolver = {
  resolveCategory: (categoryKey, number) => {
    const hit = Object.entries(CATALOG).find(
      ([, v]) => v.categoryKey === categoryKey && v.number === number,
    );
    return hit ? hit[0] : null;
  },
  hasFilename: (filename) => filename in CATALOG,
};

function song(
  partial: Partial<SelectedSong> & { filename: string },
): SelectedSong {
  return {
    transpose: 0,
    capoOverride: null,
    order: 0,
    addedAt: 0,
    ...partial,
  };
}

describe('parseSongNumber', () => {
  it('lee el número del título', () => {
    expect(parseSongNumber('12. Algo', 'x_99.html')).toBe(12);
  });
  it('cae al filename si el título no tiene número', () => {
    expect(parseSongNumber('Sin número', 'x_07.html')).toBe(7);
  });
  it('devuelve null si no hay número', () => {
    expect(parseSongNumber('Sin número', 'x.html')).toBeNull();
  });
});

describe('encode/decode offline playlist', () => {
  it('codifica de forma compacta por categoría + número', () => {
    const songs: SelectedSong[] = [
      song({ filename: 'cancion-entrada_05.html', order: 0 }),
      song({ filename: 'cancion-adoracion_42.html', order: 1, transpose: 2 }),
      song({
        filename: 'cancion-comunion_01.html',
        order: 2,
        transpose: -1,
        capoOverride: 3,
      }),
    ];
    const payload = encodeOfflinePlaylist(songs, resolveInfo);
    expect(payload).toBe('1~D5~A42t2~C1t-1c3');
    expect(CATEGORY_CODES.entrada).toBe('D');
  });

  it('ida y vuelta preserva orden, tono y cejilla', () => {
    const songs: SelectedSong[] = [
      song({
        filename: 'cancion-comunion_01.html',
        order: 0,
        transpose: -1,
        capoOverride: 3,
      }),
      song({ filename: 'cancion-entrada_05.html', order: 1 }),
    ];
    const payload = encodeOfflinePlaylist(songs, resolveInfo);
    const { songs: out, missing } = decodeOfflinePlaylist(
      payload,
      filenameResolver,
    );
    expect(missing).toBe(0);
    expect(out.map((s) => s.filename)).toEqual([
      'cancion-comunion_01.html',
      'cancion-entrada_05.html',
    ]);
    expect(out[0].transpose).toBe(-1);
    expect(out[0].capoOverride).toBe(3);
    expect(out[0].order).toBe(0);
    expect(out[1].order).toBe(1);
  });

  it('usa entrada cruda (filename) cuando la categoría es desconocida', () => {
    const songs: SelectedSong[] = [
      song({ filename: 'rara-sin-categoria_03.html', order: 0, transpose: 1 }),
    ];
    const payload = encodeOfflinePlaylist(songs, resolveInfo);
    expect(payload).toBe("1~_rara-sin-categoria_03.html't1");
    const { songs: out, missing } = decodeOfflinePlaylist(
      payload,
      filenameResolver,
    );
    expect(missing).toBe(0);
    expect(out[0].filename).toBe('rara-sin-categoria_03.html');
    expect(out[0].transpose).toBe(1);
  });

  it('cuenta como missing las canciones no presentes en el catálogo receptor', () => {
    const { songs: out, missing } = decodeOfflinePlaylist(
      '1~D5~E99', // E99 = himnos nº99, no existe en el catálogo
      filenameResolver,
    );
    expect(out.map((s) => s.filename)).toEqual(['cancion-entrada_05.html']);
    expect(missing).toBe(1);
  });
});

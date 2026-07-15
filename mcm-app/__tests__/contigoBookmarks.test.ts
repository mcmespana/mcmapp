import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BOOKMARKS_KEY,
  countHighlights,
  hasHighlights,
  loadLocalBookmarks,
  upsertLocalBookmark,
  removeLocalBookmark,
  mergeRemoteBookmarks,
  type StoredBookmark,
} from '@/utils/contigoBookmarks';

const mk = (
  date: string,
  bookmarkedAt: number,
  extra: Partial<StoredBookmark> = {},
): StoredBookmark => ({
  date,
  bookmarkedAt,
  readings: null,
  ...extra,
});

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('countHighlights / hasHighlights', () => {
  it('cuenta las frases subrayadas de todas las fuentes', () => {
    const b = mk('2026-01-01', 1, {
      highlights: { evangelio: ['a', 'b'], salmo: ['c'] },
    });
    expect(countHighlights(b)).toBe(3);
    expect(hasHighlights(b)).toBe(true);
  });

  it('devuelve 0 / false sin subrayados', () => {
    expect(countHighlights(mk('2026-01-01', 1))).toBe(0);
    expect(hasHighlights(mk('2026-01-01', 1))).toBe(false);
    expect(hasHighlights(null)).toBe(false);
  });
});

describe('almacenamiento local', () => {
  it('migra el formato antiguo (array de strings) descartándolo', async () => {
    await AsyncStorage.setItem(
      BOOKMARKS_KEY,
      JSON.stringify(['2026-01-01', '2026-01-02']),
    );
    expect(await loadLocalBookmarks()).toEqual([]);
  });

  it('upsert reemplaza por fecha y ordena por bookmarkedAt desc', async () => {
    await upsertLocalBookmark(mk('2026-01-01', 100));
    await upsertLocalBookmark(mk('2026-01-02', 200));
    const next = await upsertLocalBookmark(mk('2026-01-01', 300));
    expect(next.map((b) => b.date)).toEqual(['2026-01-01', '2026-01-02']);
    expect(next).toHaveLength(2);
  });

  it('remove elimina por fecha', async () => {
    await upsertLocalBookmark(mk('2026-01-01', 100));
    await upsertLocalBookmark(mk('2026-01-02', 200));
    const next = await removeLocalBookmark('2026-01-01');
    expect(next.map((b) => b.date)).toEqual(['2026-01-02']);
  });
});

describe('mergeRemoteBookmarks', () => {
  it('el remoto más reciente aporta el texto y sobrevive al borrado', async () => {
    await upsertLocalBookmark(mk('2026-01-01', 100)); // local sin texto
    const remote = [
      mk('2026-01-01', 200, {
        readings: { evangelio: { texto: 'T', cita: 'Jn 1', comentario: '', comentarista: '', url: '' } },
      }),
      mk('2026-02-02', 50),
    ];
    const merged = await mergeRemoteBookmarks(remote);
    const jan = merged.find((b) => b.date === '2026-01-01');
    expect(jan?.readings?.evangelio?.texto).toBe('T');
    expect(merged.map((b) => b.date)).toContain('2026-02-02');
  });

  it('conserva las readings locales si el remoto no las trae', async () => {
    await upsertLocalBookmark(
      mk('2026-01-01', 100, {
        readings: { evangelio: { texto: 'local', cita: '', comentario: '', comentarista: '', url: '' } },
      }),
    );
    const merged = await mergeRemoteBookmarks([mk('2026-01-01', 300)]);
    expect(merged[0].readings?.evangelio?.texto).toBe('local');
  });
});

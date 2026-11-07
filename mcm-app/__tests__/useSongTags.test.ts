/**
 * Tests de `hooks/useSongTags.ts`.
 *
 * Wiring entre `useFirebaseData` y el índice puro de `utils/songTags.ts`
 * (ya testeado en `songTags.test.ts`): aquí solo importa que cada hook pida
 * el path correcto y pase los datos al índice sin perder nada por el camino.
 */
import { renderHook } from '@testing-library/react-native';
import {
  useTagCatalog,
  useSongTagIndex,
  useSongTags,
} from '@/hooks/useSongTags';

let mockData: Record<string, unknown> = {};

jest.mock('@/hooks/useFirebaseData', () => ({
  useFirebaseData: (path: string) => ({ data: mockData[path] ?? null }),
}));

beforeEach(() => {
  mockData = {};
});

describe('useTagCatalog', () => {
  it('devuelve null si songs/tags aún no existe', async () => {
    const { result } = await renderHook(() => useTagCatalog());
    expect(result.current).toBeNull();
  });

  it('devuelve el catálogo crudo cuando existe', async () => {
    mockData['songs/tags'] = { adviento: { emoji: '🕯️' } };
    const { result } = await renderHook(() => useTagCatalog());
    expect(result.current).toEqual({ adviento: { emoji: '🕯️' } });
  });
});

describe('useSongTagIndex', () => {
  it('sin songsData, devuelve un índice vacío', async () => {
    const { result } = await renderHook(() => useSongTagIndex(null));
    expect(result.current.tags).toEqual([]);
  });

  it('construye el índice a partir de canciones con tags', async () => {
    const songsData = {
      entrada: {
        categoryTitle: 'C. Entrada',
        songs: [{ title: 'Canción', tags: ['adviento'] }],
      },
    } as never;
    const { result } = await renderHook(() => useSongTagIndex(songsData));
    expect(result.current.tags.map((t) => t.slug)).toContain('adviento');
  });
});

describe('useSongTags', () => {
  it('descarga songs y construye el índice sin songsData externo', async () => {
    mockData['songs'] = {
      entrada: {
        categoryTitle: 'C. Entrada',
        songs: [{ title: 'Canción', tags: ['pascua'] }],
      },
    };
    const { result } = await renderHook(() => useSongTags());
    expect(result.current.tags.map((t) => t.slug)).toContain('pascua');
  });

  it('sin canciones, devuelve un índice vacío', async () => {
    const { result } = await renderHook(() => useSongTags());
    expect(result.current.tags).toEqual([]);
  });
});

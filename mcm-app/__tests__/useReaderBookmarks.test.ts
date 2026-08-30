/**
 * Tests de `useReaderBookmarks`: guardar/quitar el evangelio del día y sus
 * subrayados en CONTIGO. La lógica de almacenamiento (local + RTDB) ya está
 * testeada en `contigoBookmarks.test.ts` y `authHelpers.test.ts` — aquí se
 * mockea y se cubre solo la orquestación del hook:
 *
 *  - Sin sesión, nunca se toca RTDB (ni al hidratar ni al guardar).
 *  - Con sesión, se hidrata desde RTDB al montar (solo si hay algo remoto) y
 *    cada cambio local también se sincroniza.
 *  - `setHighlights` auto-crea el bookmark si hace falta y limpia la clave de
 *    una fuente cuando se queda sin rangos (no debe dejar `highlights: {}`
 *    residual con arrays vacíos dentro).
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchContigoBookmarks,
  syncContigoBookmark,
} from '@/utils/authHelpers';
import {
  loadLocalBookmarks,
  upsertLocalBookmark,
  removeLocalBookmark,
  mergeRemoteBookmarks,
} from '@/utils/contigoBookmarks';
import { useReaderBookmarks } from '@/hooks/useReaderBookmarks';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));
jest.mock('@/utils/authHelpers', () => ({
  fetchContigoBookmarks: jest.fn(() => Promise.resolve([])),
  syncContigoBookmark: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/utils/contigoBookmarks', () => ({
  loadLocalBookmarks: jest.fn(() => Promise.resolve([])),
  upsertLocalBookmark: jest.fn((b) => Promise.resolve([b])),
  removeLocalBookmark: jest.fn(() => Promise.resolve([])),
  mergeRemoteBookmarks: jest.fn((remote) => Promise.resolve(remote)),
}));

const sampleBookmark = (date: string) => ({
  date,
  bookmarkedAt: 1000,
  readings: null,
});

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ user: null });
  (loadLocalBookmarks as jest.Mock).mockResolvedValue([]);
});

describe('hidratación al montar', () => {
  it('sin sesión, solo carga local y no toca RTDB', async () => {
    (loadLocalBookmarks as jest.Mock).mockResolvedValue([
      sampleBookmark('2026-08-20'),
    ]);
    const { result } = await renderHook(() => useReaderBookmarks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.bookmarks).toEqual([sampleBookmark('2026-08-20')]);
    expect(fetchContigoBookmarks).not.toHaveBeenCalled();
  });

  it('con sesión, hidrata desde RTDB si hay algo remoto', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { uid: 'u1' } });
    (fetchContigoBookmarks as jest.Mock).mockResolvedValue([
      sampleBookmark('2026-08-19'),
    ]);
    (mergeRemoteBookmarks as jest.Mock).mockResolvedValue([
      sampleBookmark('2026-08-19'),
      sampleBookmark('2026-08-20'),
    ]);
    const { result } = await renderHook(() => useReaderBookmarks());
    await waitFor(() => expect(result.current.bookmarks.length).toBe(2));
    expect(fetchContigoBookmarks).toHaveBeenCalledWith('u1');
    expect(mergeRemoteBookmarks).toHaveBeenCalledWith([
      sampleBookmark('2026-08-19'),
    ]);
  });

  it('con sesión pero sin nada remoto, no llama a mergeRemoteBookmarks', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { uid: 'u1' } });
    (fetchContigoBookmarks as jest.Mock).mockResolvedValue([]);
    await renderHook(() => useReaderBookmarks());
    await waitFor(() => expect(fetchContigoBookmarks).toHaveBeenCalled());
    expect(mergeRemoteBookmarks).not.toHaveBeenCalled();
  });

  it('reload() vuelve a leer lo local', async () => {
    const { result } = await renderHook(() => useReaderBookmarks());
    (loadLocalBookmarks as jest.Mock).mockResolvedValue([
      sampleBookmark('2026-08-20'),
    ]);
    await act(async () => result.current.reload());
    expect(result.current.bookmarks).toEqual([sampleBookmark('2026-08-20')]);
  });
});

describe('getBookmark / isBookmarked', () => {
  it('encuentran el bookmark del día exacto', async () => {
    (loadLocalBookmarks as jest.Mock).mockResolvedValue([
      sampleBookmark('2026-08-20'),
    ]);
    const { result } = await renderHook(() => useReaderBookmarks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isBookmarked('2026-08-20')).toBe(true);
    expect(result.current.isBookmarked('2026-08-21')).toBe(false);
    expect(result.current.getBookmark('2026-08-20')).toEqual(
      sampleBookmark('2026-08-20'),
    );
  });
});

describe('toggleBookmark', () => {
  it('guarda un día nuevo y sincroniza con RTDB si hay sesión', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { uid: 'u1' } });
    const { result } = await renderHook(() => useReaderBookmarks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.current.toggleBookmark('2026-08-20', null);
    });
    expect(saved).toBe(true);
    expect(upsertLocalBookmark).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-08-20', readings: null }),
    );
    expect(syncContigoBookmark).toHaveBeenCalledWith(
      'u1',
      '2026-08-20',
      expect.objectContaining({ date: '2026-08-20' }),
    );
  });

  it('quita un día ya guardado y sincroniza el borrado (null) si hay sesión', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { uid: 'u1' } });
    (loadLocalBookmarks as jest.Mock).mockResolvedValue([
      sampleBookmark('2026-08-20'),
    ]);
    const { result } = await renderHook(() => useReaderBookmarks());
    await waitFor(() => expect(result.current.isBookmarked('2026-08-20')).toBe(true));

    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.current.toggleBookmark('2026-08-20', null);
    });
    expect(saved).toBe(false);
    expect(removeLocalBookmark).toHaveBeenCalledWith('2026-08-20');
    expect(syncContigoBookmark).toHaveBeenCalledWith('u1', '2026-08-20', null);
  });

  it('sin sesión, no toca RTDB al guardar ni al quitar', async () => {
    const { result } = await renderHook(() => useReaderBookmarks());
    await act(async () => {
      await result.current.toggleBookmark('2026-08-20', null);
    });
    expect(syncContigoBookmark).not.toHaveBeenCalled();
  });
});

describe('removeBookmark', () => {
  it('quita el día y sincroniza el borrado si hay sesión', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { uid: 'u1' } });
    const { result } = await renderHook(() => useReaderBookmarks());
    await act(async () => result.current.removeBookmark('2026-08-20'));
    expect(removeLocalBookmark).toHaveBeenCalledWith('2026-08-20');
    expect(syncContigoBookmark).toHaveBeenCalledWith('u1', '2026-08-20', null);
  });
});

describe('setHighlights', () => {
  it('auto-crea el bookmark si el día no estaba guardado', async () => {
    const { result } = await renderHook(() => useReaderBookmarks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () =>
      result.current.setHighlights(
        '2026-08-20',
        'evangelio',
        [{ start: 0, end: 5, color: 'yellow' } as any],
        null,
      ),
    );
    expect(upsertLocalBookmark).toHaveBeenCalledWith(
      expect.objectContaining({
        date: '2026-08-20',
        highlights: { evangelio: [{ start: 0, end: 5, color: 'yellow' }] },
      }),
    );
  });

  it('borra la clave de la fuente cuando se queda sin rangos', async () => {
    (loadLocalBookmarks as jest.Mock).mockResolvedValue([
      {
        ...sampleBookmark('2026-08-20'),
        highlights: { evangelio: [{ start: 0, end: 5, color: 'yellow' } as any] },
      },
    ]);
    const { result } = await renderHook(() => useReaderBookmarks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () =>
      result.current.setHighlights('2026-08-20', 'evangelio', [], null),
    );
    const written = (upsertLocalBookmark as jest.Mock).mock.calls[0][0];
    expect(written.highlights).toBeUndefined();
  });

  it('conserva los subrayados de otras fuentes al tocar una', async () => {
    (loadLocalBookmarks as jest.Mock).mockResolvedValue([
      {
        ...sampleBookmark('2026-08-20'),
        highlights: { salmo: [{ start: 1, end: 2, color: 'blue' } as any] },
      },
    ]);
    const { result } = await renderHook(() => useReaderBookmarks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () =>
      result.current.setHighlights(
        '2026-08-20',
        'evangelio',
        [{ start: 0, end: 5, color: 'yellow' } as any],
        null,
      ),
    );
    const written = (upsertLocalBookmark as jest.Mock).mock.calls[0][0];
    expect(written.highlights).toEqual({
      salmo: [{ start: 1, end: 2, color: 'blue' }],
      evangelio: [{ start: 0, end: 5, color: 'yellow' }],
    });
  });
});

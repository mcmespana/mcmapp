import { useCallback, useEffect, useState } from 'react';
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
  type StoredBookmark,
  type BookmarkHighlights,
  type HighlightSource,
} from '@/utils/contigoBookmarks';
import type { DailyReadings } from '@/hooks/useDailyReadings';

/**
 * Gestión centralizada de los bookmarks de evangelio de CONTIGO.
 *
 * - Guarda el TEXTO COMPLETO de las lecturas (local + RTDB por usuario) para que
 *   los guardados sobrevivan al borrado a 30 días del nodo global de lecturas.
 * - Hidrata desde RTDB al iniciar sesión (multi-dispositivo / reinstalación).
 * - Soporta subrayados por fuente (evangelio / salmo), que auto-crean bookmark.
 */
export function useReaderBookmarks() {
  const { user: authUser } = useAuth();
  const [bookmarks, setBookmarks] = useState<StoredBookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    const local = await loadLocalBookmarks();
    setBookmarks(local);
    setIsLoading(false);
    return local;
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const local = await loadLocalBookmarks();
      if (mounted) {
        setBookmarks(local);
        setIsLoading(false);
      }
      // Hidratar desde RTDB si hay sesión — funde texto completo remoto.
      if (authUser) {
        const remote = await fetchContigoBookmarks(authUser.uid);
        if (remote.length > 0) {
          const merged = await mergeRemoteBookmarks(remote);
          if (mounted) setBookmarks(merged);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [authUser]);

  const getBookmark = useCallback(
    (date: string): StoredBookmark | undefined =>
      bookmarks.find((b) => b.date === date),
    [bookmarks],
  );

  const isBookmarked = useCallback(
    (date: string): boolean => bookmarks.some((b) => b.date === date),
    [bookmarks],
  );

  /** Persiste local + RTDB. */
  const persist = useCallback(
    async (bookmark: StoredBookmark) => {
      const next = await upsertLocalBookmark(bookmark);
      setBookmarks(next);
      if (authUser) syncContigoBookmark(authUser.uid, bookmark.date, bookmark);
    },
    [authUser],
  );

  /** Marca/desmarca un día. Al marcar guarda el texto completo. Devuelve el
   *  nuevo estado (true = ahora guardado). */
  const toggleBookmark = useCallback(
    async (date: string, readings: DailyReadings | null): Promise<boolean> => {
      const existing = getBookmark(date);
      if (existing) {
        const next = await removeLocalBookmark(date);
        setBookmarks(next);
        if (authUser) syncContigoBookmark(authUser.uid, date, null);
        return false;
      }
      await persist({
        date,
        bookmarkedAt: Date.now(),
        readings: readings ?? null,
      });
      return true;
    },
    [getBookmark, persist, authUser],
  );

  const removeBookmark = useCallback(
    async (date: string) => {
      const next = await removeLocalBookmark(date);
      setBookmarks(next);
      if (authUser) syncContigoBookmark(authUser.uid, date, null);
    },
    [authUser],
  );

  /** Fija las frases subrayadas de una fuente. Auto-crea el bookmark si no
   *  existe (para no perder ni el subrayado ni el texto). */
  const setHighlights = useCallback(
    async (
      date: string,
      source: HighlightSource,
      texts: string[],
      readings: DailyReadings | null,
    ) => {
      const existing = getBookmark(date);
      const prevHighlights: BookmarkHighlights = existing?.highlights ?? {};
      const highlights: BookmarkHighlights = { ...prevHighlights };
      if (texts.length > 0) highlights[source] = texts;
      else delete highlights[source];

      await persist({
        date,
        bookmarkedAt: existing?.bookmarkedAt ?? Date.now(),
        readings: existing?.readings ?? readings ?? null,
        highlights: Object.keys(highlights).length ? highlights : undefined,
      });
    },
    [getBookmark, persist],
  );

  return {
    bookmarks,
    isLoading,
    getBookmark,
    isBookmarked,
    toggleBookmark,
    removeBookmark,
    setHighlights,
    reload,
  };
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/utils/logger';
import type { DailyReadings } from '@/hooks/useDailyReadings';

export const BOOKMARKS_KEY = '@contigo_bookmarks';

/** Fuentes de texto que se pueden subrayar dentro de un día. */
export type HighlightSource = 'evangelio' | 'salmo';

export type BookmarkHighlights = Partial<Record<HighlightSource, string[]>>;

export interface StoredBookmark {
  date: string;
  bookmarkedAt: number;
  /** Texto completo de las lecturas — guardado para que el bookmark sobreviva
   *  al borrado a 30 días del nodo global de lecturas. */
  readings: DailyReadings | null;
  /** Frases subrayadas por el usuario, por fuente. */
  highlights?: BookmarkHighlights;
}

/** ¿Tiene el bookmark al menos un subrayado? */
export function hasHighlights(b: StoredBookmark | undefined | null): boolean {
  if (!b?.highlights) return false;
  return Object.values(b.highlights).some((arr) => (arr?.length ?? 0) > 0);
}

/** Número total de frases subrayadas en un bookmark. */
export function countHighlights(b: StoredBookmark | undefined | null): number {
  if (!b?.highlights) return 0;
  return Object.values(b.highlights).reduce(
    (acc, arr) => acc + (arr?.length ?? 0),
    0,
  );
}

// ── Almacenamiento local ────────────────────────────────────────────────────

/** Lee los bookmarks locales, migrando el formato antiguo (array de strings de
 *  fechas) al formato de objeto y descartando entradas inválidas. */
export async function loadLocalBookmarks(): Promise<StoredBookmark[]> {
  try {
    const str = await AsyncStorage.getItem(BOOKMARKS_KEY);
    if (!str) return [];
    const parsed = JSON.parse(str);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (b: unknown): b is StoredBookmark =>
          !!b && typeof b === 'object' && typeof (b as any).date === 'string',
      )
      .sort((a, b) => b.bookmarkedAt - a.bookmarkedAt);
  } catch (e) {
    logger.error('[contigoBookmarks] loadLocalBookmarks', e);
    return [];
  }
}

async function saveLocalBookmarks(list: StoredBookmark[]): Promise<void> {
  try {
    await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(list));
  } catch (e) {
    logger.error('[contigoBookmarks] saveLocalBookmarks', e);
  }
}

/** Inserta o reemplaza un bookmark y persiste. Devuelve la lista resultante. */
export async function upsertLocalBookmark(
  bookmark: StoredBookmark,
): Promise<StoredBookmark[]> {
  const list = await loadLocalBookmarks();
  const next = [bookmark, ...list.filter((b) => b.date !== bookmark.date)].sort(
    (a, b) => b.bookmarkedAt - a.bookmarkedAt,
  );
  await saveLocalBookmarks(next);
  return next;
}

/** Elimina un bookmark por fecha y persiste. Devuelve la lista resultante. */
export async function removeLocalBookmark(
  date: string,
): Promise<StoredBookmark[]> {
  const list = await loadLocalBookmarks();
  const next = list.filter((b) => b.date !== date);
  await saveLocalBookmarks(next);
  return next;
}

/** Funde los bookmarks remotos (RTDB, con texto completo) con los locales.
 *  Ante conflicto gana el más reciente (`bookmarkedAt` mayor). Persiste el
 *  resultado y lo devuelve — así los guardados sobreviven a reinstalaciones y
 *  al borrado a 30 días del nodo global de lecturas. */
export async function mergeRemoteBookmarks(
  remote: StoredBookmark[],
): Promise<StoredBookmark[]> {
  const local = await loadLocalBookmarks();
  const byDate = new Map<string, StoredBookmark>();
  for (const b of local) byDate.set(b.date, b);
  for (const r of remote) {
    const existing = byDate.get(r.date);
    if (!existing || (r.bookmarkedAt ?? 0) >= (existing.bookmarkedAt ?? 0)) {
      // Preferimos el remoto, pero conservamos las readings locales si el
      // remoto no las trae (por si un guardado antiguo iba sin texto).
      byDate.set(r.date, {
        ...r,
        readings: r.readings ?? existing?.readings ?? null,
      });
    }
  }
  const next = Array.from(byDate.values()).sort(
    (a, b) => b.bookmarkedAt - a.bookmarkedAt,
  );
  await saveLocalBookmarks(next);
  return next;
}

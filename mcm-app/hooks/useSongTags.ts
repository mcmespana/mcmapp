/**
 * Acceso a las etiquetas del cantoral.
 *
 * El catálogo de metadatos vive en `songs/tags` (lo publica el generador de
 * `mcmapp-cantoral` junto a `songs/data`). Es OPCIONAL: si el nodo no existe
 * todavía, `useFirebaseData` devuelve `null` sin ruido y las etiquetas se
 * pintan con el slug capitalizado.
 *
 * El índice inverso (etiqueta → canciones) NO se descarga: se construye con un
 * memo sobre los datos de canciones que la pantalla ya tiene.
 */
import { useMemo } from 'react';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { filterSongsData, type SongsData } from '@/utils/filterSongsData';
import { buildTagIndex, type SongTagIndex } from '@/utils/songTags';

/** Catálogo crudo de `songs/tags`, o `null` si aún no se ha publicado. */
export function useTagCatalog(): unknown {
  const { data } = useFirebaseData<unknown>('songs/tags', 'songTags');
  return data ?? null;
}

/**
 * Índice de etiquetas a partir de unos datos de canciones que la pantalla ya
 * tiene descargados (el caso normal: Categorías y la lista de canciones).
 */
export function useSongTagIndex(
  songsData: SongsData | null | undefined,
): SongTagIndex {
  const catalog = useTagCatalog();
  return useMemo(() => buildTagIndex(songsData, catalog), [songsData, catalog]);
}

/**
 * Índice de etiquetas con descarga propia de las canciones. Para pantallas que
 * no tienen `songsData` a mano (el detalle de canción). No hay coste extra de
 * red: `useFirebaseData` deduplica por `storageKey` a nivel de módulo.
 */
export function useSongTags(): SongTagIndex {
  const { data } = useFirebaseData<SongsData | null>(
    'songs',
    'songs',
    filterSongsData,
  );
  return useSongTagIndex(data);
}

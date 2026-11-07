/**
 * La canción que pide la ruta del cantoral (`/cancionero/cancion`,
 * `/cancionero/pantalla-completa`): los params son texto (`filename`, `list`,
 * `currentIndex`…), y la canción se busca en este orden:
 *
 *   1. en la lista con la que se abrió (`utils/songNavList.ts`): es la que
 *      eligió quien navega —p. ej. la del líder del coro, o la letra viva con
 *      un arreglo recién añadido—;
 *   2. en el catálogo (`songs`, la misma caché que pintan las listas);
 *   3. en el coro, si se está escuchando y es la canción del líder.
 *
 * `loading` es «todavía puede aparecer» (el catálogo aún carga en frío).
 */
import { useMemo } from 'react';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useChoirSession } from '@/contexts/ChoirSessionContext';
import { filterSongsData, type SongsData } from '@/utils/filterSongsData';
import { extractSongMedia } from '@/types/songMedia';
import {
  findCatalogSong,
  getSongNavList,
  routeIndex,
  songFromList,
  type SongNavItem,
  type SongRouteParams,
} from '@/utils/songNavList';

export interface RouteSong {
  song: SongNavItem | null;
  /** La lista por la que se pasa de canción, si la hay. */
  list: SongNavItem[] | null;
  /** Posición de la canción en `list`. */
  index: number | undefined;
  /** Categoría del catálogo (la de la ruta o donde se encontró). */
  firebaseCategory: string | undefined;
  loading: boolean;
}

export function useRouteSong(params: Partial<SongRouteParams>): RouteSong {
  const filename = typeof params.filename === 'string' ? params.filename : '';
  const { data, loading } = useFirebaseData<SongsData>(
    'songs',
    'songs',
    filterSongsData as (data: unknown) => SongsData,
  );
  const choir = useChoirSession();
  const remote = choir.mode === 'slave' ? choir.session?.current : null;

  return useMemo<RouteSong>(() => {
    const list = getSongNavList(params.list);
    const wanted = routeIndex(params.currentIndex);
    const inList = songFromList(list, filename, wanted);
    const catalog = inList
      ? null
      : findCatalogSong(data, filename, params.firebaseCategory);
    let song = inList?.song ?? catalog?.song ?? null;
    if (!song && remote?.filename === filename && remote.content) {
      song = {
        filename: remote.filename,
        title: remote.title ?? remote.filename,
        author: remote.author,
        key: remote.songKey,
        capo: remote.capo,
        content: remote.content,
        media: extractSongMedia(remote) ?? undefined,
      };
    }
    return {
      song,
      list: inList ? list : null,
      index: inList?.index,
      firebaseCategory:
        params.firebaseCategory ??
        catalog?.category ??
        (song === null ? undefined : remote?.firebaseCategory),
      loading: !song && loading,
    };
  }, [
    data,
    loading,
    filename,
    params.list,
    params.currentIndex,
    params.firebaseCategory,
    remote,
  ]);
}

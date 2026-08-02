// hooks/useAlbumPagination.ts
// Paginación "cargar más" de la lista de álbumes. La usan las DOS pantallas de
// fotos —el tab (`app/(tabs)/fotos.tsx`) y la de dentro de un evento
// (`app/screens/AlbumListScreen.tsx`)—, que antes repetían el mismo bloque.
//
// La lista visible es DERIVADA (`slice` de la completa), no una copia guardada
// en estado y rellenada por un efecto. Eso quita el aviso de
// `set-state-in-effect` y, sobre todo, arregla un comportamiento molesto: antes,
// cuando Firebase refrescaba los álbumes, el efecto volvía a la primera página
// y al usuario le desaparecía todo lo que llevaba cargado.

import { useCallback, useMemo, useState } from 'react';

export const ALBUMS_PER_PAGE = 4;

export interface AlbumPagination<T> {
  /** Los álbumes que toca pintar ahora mismo. */
  displayedAlbums: T[];
  /** `true` si ya no queda nada más que cargar (esconde el botón). */
  allAlbumsLoaded: boolean;
  /** Avanza una página. No hace nada si ya están todos. */
  loadMoreAlbums: () => void;
}

/**
 * @param sortedAlbums Lista COMPLETA ya filtrada y ordenada.
 */
export function useAlbumPagination<T>(sortedAlbums: T[]): AlbumPagination<T> {
  const [page, setPage] = useState(0);

  const displayedAlbums = useMemo(
    () => sortedAlbums.slice(0, (page + 1) * ALBUMS_PER_PAGE),
    [sortedAlbums, page],
  );

  const allAlbumsLoaded = displayedAlbums.length >= sortedAlbums.length;

  const loadMoreAlbums = useCallback(() => {
    // Sin tope explícito: `displayedAlbums` es un `slice`, así que pasarse de
    // largo devuelve la lista entera igual. El tope evita que `page` crezca
    // sin límite mientras `onEndReached` sigue disparando al final de la lista.
    setPage((prev) =>
      (prev + 1) * ALBUMS_PER_PAGE < sortedAlbums.length ? prev + 1 : prev,
    );
  }, [sortedAlbums.length]);

  return { displayedAlbums, allAlbumsLoaded, loadMoreAlbums };
}

export default useAlbumPagination;

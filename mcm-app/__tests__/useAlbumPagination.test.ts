// Paginación "cargar más" compartida por el tab de Fotos y la lista de álbumes
// de dentro de un evento. Lo que se protege aquí es sobre todo que la lista
// visible sea DERIVADA: cuando Firebase refresca los álbumes, el usuario NO
// puede perder lo que llevaba cargado (antes un efecto lo devolvía a la página 1).

import { act, renderHook } from '@testing-library/react-native';
import {
  ALBUMS_PER_PAGE,
  useAlbumPagination,
} from '@/hooks/useAlbumPagination';

const albums = (n: number) => Array.from({ length: n }, (_, i) => `a${i}`);

describe('useAlbumPagination', () => {
  it('arranca mostrando la primera página', async () => {
    const { result } = await renderHook(() => useAlbumPagination(albums(10)));

    expect(result.current.displayedAlbums).toHaveLength(ALBUMS_PER_PAGE);
    expect(result.current.allAlbumsLoaded).toBe(false);
  });

  it('cada "cargar más" añade una página', async () => {
    const { result } = await renderHook(() => useAlbumPagination(albums(10)));

    await act(async () => result.current.loadMoreAlbums());
    expect(result.current.displayedAlbums).toHaveLength(ALBUMS_PER_PAGE * 2);

    await act(async () => result.current.loadMoreAlbums());
    expect(result.current.displayedAlbums).toHaveLength(10);
    expect(result.current.allAlbumsLoaded).toBe(true);
  });

  it('si caben todos en una página, no ofrece cargar más', async () => {
    const { result } = await renderHook(() =>
      useAlbumPagination(albums(ALBUMS_PER_PAGE)),
    );

    expect(result.current.allAlbumsLoaded).toBe(true);
  });

  it('con la lista vacía no revienta ni ofrece cargar más', async () => {
    const { result } = await renderHook(() => useAlbumPagination<string>([]));

    expect(result.current.displayedAlbums).toEqual([]);
    expect(result.current.allAlbumsLoaded).toBe(true);
  });

  it('seguir pulsando al final no dispara la página al infinito', async () => {
    const { result } = await renderHook(() => useAlbumPagination(albums(6)));

    await act(async () => result.current.loadMoreAlbums());
    await act(async () => result.current.loadMoreAlbums());
    await act(async () => result.current.loadMoreAlbums());

    expect(result.current.displayedAlbums).toHaveLength(6);
    expect(result.current.allAlbumsLoaded).toBe(true);
  });

  it('un refresco de datos NO devuelve al usuario a la primera página', async () => {
    const { result, rerender } = await renderHook(
      ({ list }: { list: string[] }) => useAlbumPagination(list),
      { initialProps: { list: albums(20) } },
    );

    await act(async () => result.current.loadMoreAlbums());
    await act(async () => result.current.loadMoreAlbums());
    expect(result.current.displayedAlbums).toHaveLength(ALBUMS_PER_PAGE * 3);

    // Llega otra referencia de la lista (Firebase ha refrescado).
    await act(async () => rerender({ list: albums(20) }));

    expect(result.current.displayedAlbums).toHaveLength(ALBUMS_PER_PAGE * 3);
  });

  it('si la lista encoge, se recorta sola sin dejar huecos', async () => {
    const { result, rerender } = await renderHook(
      ({ list }: { list: string[] }) => useAlbumPagination(list),
      { initialProps: { list: albums(20) } },
    );

    await act(async () => result.current.loadMoreAlbums());
    await act(async () => result.current.loadMoreAlbums());

    await act(async () => rerender({ list: albums(3) }));

    expect(result.current.displayedAlbums).toHaveLength(3);
    expect(result.current.allAlbumsLoaded).toBe(true);
  });
});

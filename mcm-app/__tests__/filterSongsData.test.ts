/**
 * Tests para el filtrado de canciones.
 *
 * ¿Qué testea?
 * - Que las canciones con estado "pendiente" o "borrador" se excluyan
 * - Que las canciones sin estado o con estado válido se mantengan
 * - Que devuelva null si recibe null
 * - Que las categorías se mantengan aunque queden sin canciones
 */
import {
  filterSongsData,
  SongsData,
} from '@/utils/filterSongsData';

describe('filterSongsData', () => {
  it('devuelve null si recibe null', () => {
    expect(filterSongsData(null)).toBeNull();
  });

  it('mantiene canciones sin estado (publicadas)', () => {
    const input: SongsData = {
      cat1: {
        categoryTitle: 'Adoración',
        songs: [{ title: 'Canción 1' }],
      },
    };
    const result = filterSongsData(input);
    expect(result?.cat1.songs).toHaveLength(1);
    expect(result?.cat1.songs[0].title).toBe('Canción 1');
  });

  it('filtra canciones con estado "pendiente"', () => {
    const input: SongsData = {
      cat1: {
        categoryTitle: 'Adoración',
        songs: [
          { title: 'Publicada' },
          { title: 'En espera', status: 'pendiente' },
        ],
      },
    };
    const result = filterSongsData(input);
    expect(result?.cat1.songs).toHaveLength(1);
    expect(result?.cat1.songs[0].title).toBe('Publicada');
  });

  it('filtra canciones con estado "borrador"', () => {
    const input: SongsData = {
      cat1: {
        categoryTitle: 'Test',
        songs: [
          { title: 'Visible' },
          { title: 'Borrador', status: 'borrador' },
        ],
      },
    };
    const result = filterSongsData(input);
    expect(result?.cat1.songs).toHaveLength(1);
    expect(result?.cat1.songs[0].title).toBe('Visible');
  });

  it('mantiene canciones con otros estados válidos', () => {
    const input: SongsData = {
      cat1: {
        categoryTitle: 'Test',
        songs: [{ title: 'Activa', status: 'activa' }],
      },
    };
    const result = filterSongsData(input);
    expect(result?.cat1.songs).toHaveLength(1);
  });

  it('mantiene la categoría aunque quede vacía', () => {
    const input: SongsData = {
      cat1: {
        categoryTitle: 'Vacía',
        songs: [{ title: 'Borrador', status: 'borrador' }],
      },
    };
    const result = filterSongsData(input);
    expect(result?.cat1).toBeDefined();
    expect(result?.cat1.songs).toHaveLength(0);
    expect(result?.cat1.categoryTitle).toBe('Vacía');
  });

  it('maneja múltiples categorías a la vez', () => {
    const input: SongsData = {
      cat1: {
        categoryTitle: 'Cat 1',
        songs: [
          { title: 'A' },
          { title: 'B', status: 'pendiente' },
        ],
      },
      cat2: {
        categoryTitle: 'Cat 2',
        songs: [{ title: 'C' }, { title: 'D' }],
      },
    };
    const result = filterSongsData(input);
    expect(result?.cat1.songs).toHaveLength(1);
    expect(result?.cat2.songs).toHaveLength(2);
  });
});

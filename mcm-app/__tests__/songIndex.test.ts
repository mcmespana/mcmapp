/**
 * Índice del cantoral para abrir canciones desde fuera de su stack
 * (`utils/songIndex`): la paleta ⌘K de la web y el enlace `/cancion?f=…`.
 *
 * Si falla, la paleta no encuentra «Señor» tecleando «senor», saca primero
 * una canción que solo casa por el autor, o el enlace abre otra canción.
 */
import {
  buildSongIndex,
  findSongByFilename,
  searchSongIndex,
  songOpenParams,
  songWebPath,
} from '@/utils/songIndex';
import type { SongsData } from '@/utils/filterSongsData';

const DATA: SongsData = {
  entrada: {
    categoryTitle: 'D. Cantos de entrada 🚪',
    songs: [
      {
        title: '1. Alzad las manos',
        filename: 'alzad.cho',
        author: 'Kairoi',
        key: 'G',
        capo: 2,
        content: '{title: Alzad}',
        youtubeLinks: [{ label: 'Vídeo', url: 'https://youtu.be/x' }],
      },
      { title: '2. Vienen con alegría', filename: 'vienen.cho' },
      { title: 'Sin fichero' },
    ],
  },
  comunion: {
    categoryTitle: 'C. Comunión',
    songs: [
      {
        title: '5. Señor, tú me llamas',
        filename: 'senor.cho',
        author: 'Gabarain',
      },
      {
        title: '6. Pescador de hombres',
        filename: 'pescador.cho',
        author: 'Señor Autor',
      },
    ],
  },
  salida: {
    categoryTitle: 'G. Salida',
    // Repetida en otra categoría: cuenta solo la primera (por clave).
    songs: [{ title: '1. Alzad las manos', filename: 'alzad.cho' }],
  },
};

const index = buildSongIndex(DATA);

describe('buildSongIndex', () => {
  it('aplana sin repetir fichero y se salta las canciones sin fichero', () => {
    expect(index.map((s) => s.filename).sort()).toEqual([
      'alzad.cho',
      'pescador.cho',
      'senor.cho',
      'vienen.cho',
    ]);
  });

  it('limpia el número del título y el prefijo y el emoji de la categoría', () => {
    const alzad = findSongByFilename(index, 'alzad.cho');
    expect(alzad?.title).toBe('Alzad las manos');
    expect(alzad?.categoryName).toBe('Cantos de entrada');
  });

  it('sin datos devuelve una lista vacía', () => {
    expect(buildSongIndex(null)).toEqual([]);
  });
});

describe('searchSongIndex', () => {
  it('busca sin tildes ni mayúsculas', () => {
    expect(searchSongIndex(index, 'SENOR').map((s) => s.filename)).toContain(
      'senor.cho',
    );
    expect(searchSongIndex(index, 'alegria')[0].filename).toBe('vienen.cho');
  });

  it('con menos de dos letras no busca', () => {
    expect(searchSongIndex(index, 'a')).toEqual([]);
    expect(searchSongIndex(index, '  ')).toEqual([]);
  });

  it('gana el título sobre el autor', () => {
    // «senor» está en el título de una y en el autor de otra.
    expect(searchSongIndex(index, 'senor').map((s) => s.filename)).toEqual([
      'senor.cho',
      'pescador.cho',
    ]);
  });

  it('todas las palabras tienen que estar, en cualquier orden', () => {
    expect(
      searchSongIndex(index, 'manos alzad').map((s) => s.filename),
    ).toEqual(['alzad.cho']);
    expect(searchSongIndex(index, 'alzad pescador')).toEqual([]);
  });

  it('encuentra por el número del cantoral y por el autor', () => {
    expect(searchSongIndex(index, '5. se')[0].filename).toBe('senor.cho');
    expect(searchSongIndex(index, 'kairoi')[0].filename).toBe('alzad.cho');
  });

  it('respeta el límite', () => {
    expect(searchSongIndex(index, 'cho', 2)).toHaveLength(2);
  });
});

describe('findSongByFilename / songOpenParams / songWebPath', () => {
  it('resuelve el fichero exacto y nada más', () => {
    expect(findSongByFilename(index, 'senor.cho')?.title).toBe(
      'Señor, tú me llamas',
    );
    expect(findSongByFilename(index, 'senor')).toBeNull();
    expect(findSongByFilename(index, '')).toBeNull();
  });

  it('arma los parámetros de SongDetail como el buscador global', () => {
    const params = songOpenParams(findSongByFilename(index, 'alzad.cho')!);
    // Solo texto (es una ruta): la letra la lee el detalle del catálogo. Sin
    // lista ni `source`: la analítica lo cuenta como «búsqueda».
    expect(params).toEqual({
      filename: 'alzad.cho',
      firebaseCategory: 'entrada',
    });
  });

  it('el enlace web codifica el fichero', () => {
    expect(songWebPath('a b&c.cho')).toBe('/cancion?f=a%20b%26c.cho');
  });
});

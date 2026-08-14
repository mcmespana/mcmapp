import {
  buildTagIndex,
  coOccurringTags,
  isTagCategoryId,
  normalizeTagCatalog,
  parseTagCategoryId,
  prettyTagLabel,
  resolveTag,
  slugifyTag,
  songHasAllTags,
  songTagSlugs,
  tagCategoryId,
  tagCloudBucket,
  tagsTitle,
} from '@/utils/songTags';
import type { SongsData } from '@/utils/filterSongsData';

const songsData: SongsData = {
  entrada: {
    categoryTitle: 'C. Cantos de entrada',
    songs: [
      { title: '12. Alma misionera', tags: ['viejunas', 'envio'] },
      { title: '04. Vienen con alegría', tags: ['Viejunas'] },
      { title: '07. Sin etiquetas' },
    ],
  },
  maria: {
    categoryTitle: 'M. María',
    songs: [
      { title: '04. Junto a ti, María', tags: ['viejunas', 'infantiles'] },
      { title: '09. Santa María', tags: ['mariana'] },
    ],
  },
};

describe('slugifyTag', () => {
  it('normaliza acentos, mayúsculas y espacios', () => {
    expect(slugifyTag('Domingo de Ramos')).toBe('domingo-de-ramos');
    expect(slugifyTag('  Animación  ')).toBe('animacion');
    expect(slugifyTag('Taizé')).toBe('taize');
    expect(slugifyTag('Niños')).toBe('ninos');
  });

  it('colapsa separadores repetidos y no deja guiones sueltos', () => {
    expect(slugifyTag('--envío / salida--')).toBe('envio-salida');
    expect(slugifyTag('!!!')).toBe('');
  });
});

describe('prettyTagLabel', () => {
  it('capitaliza el slug cuando no hay catálogo', () => {
    expect(prettyTagLabel('domingo-de-ramos')).toBe('Domingo de ramos');
    expect(prettyTagLabel('')).toBe('');
  });
});

describe('categoría virtual __TAG__:', () => {
  it('va y vuelve', () => {
    expect(tagCategoryId(['viejunas'])).toBe('__TAG__:viejunas');
    expect(parseTagCategoryId('__TAG__:viejunas')).toEqual(['viejunas']);
    expect(parseTagCategoryId('__TAG__:viejunas+envio')).toEqual([
      'viejunas',
      'envio',
    ]);
  });

  it('no confunde una categoría normal ni una vacía', () => {
    expect(parseTagCategoryId('entrada')).toBeNull();
    expect(parseTagCategoryId('__ALL__')).toBeNull();
    expect(parseTagCategoryId('__TAG__:')).toBeNull();
    expect(isTagCategoryId('__TAG__:viejunas')).toBe(true);
    expect(isTagCategoryId('__ALL__')).toBe(false);
  });
});

describe('normalizeTagCatalog', () => {
  it('tolera basura sin lanzar', () => {
    expect(normalizeTagCatalog(null)).toEqual({ entries: {}, aliases: {} });
    expect(normalizeTagCatalog('nope')).toEqual({ entries: {}, aliases: {} });
    expect(normalizeTagCatalog(42)).toEqual({ entries: {}, aliases: {} });
  });

  it('acepta el mapa envuelto, claves sin normalizar y labels sueltos', () => {
    const { entries } = normalizeTagCatalog({
      tags: {
        'Domingo de Ramos': { label: 'Domingo de Ramos', emoji: '🌿' },
        viejunas: 'Viejunas',
      },
    });
    expect(entries['domingo-de-ramos']).toEqual({
      label: 'Domingo de Ramos',
      emoji: '🌿',
      orden: undefined,
      destacada: false,
    });
    expect(entries.viejunas?.label).toBe('Viejunas');
  });

  it('mapea los alias al slug canónico y no pisa etiquetas declaradas', () => {
    const { aliases } = normalizeTagCatalog({
      viejunas: { label: 'Viejunas', alias: ['viejuna', 'Antiguas'] },
      antiguas: { label: 'Antiguas' },
    });
    expect(aliases.viejuna).toBe('viejunas');
    // `antiguas` está declarada por su cuenta: gana la declarada.
    expect(aliases.antiguas).toBeUndefined();
  });
});

describe('songTagSlugs', () => {
  it('normaliza, deduplica y aplica alias', () => {
    const aliases = { viejuna: 'viejunas' };
    expect(
      songTagSlugs({ tags: ['Viejunas', 'viejuna', 'Envío'] }, aliases),
    ).toEqual(['viejunas', 'envio']);
  });

  it('acepta una cadena separada por comas y tolera lo que no lo es', () => {
    expect(songTagSlugs({ tags: 'viejunas, envio' })).toEqual([
      'viejunas',
      'envio',
    ]);
    expect(songTagSlugs({ tags: 42 })).toEqual([]);
    expect(songTagSlugs(null)).toEqual([]);
    expect(songTagSlugs({})).toEqual([]);
  });
});

describe('songHasAllTags', () => {
  const song = { tags: ['viejunas', 'infantiles'] };
  it('cruza en AND', () => {
    expect(songHasAllTags(song, ['viejunas'])).toBe(true);
    expect(songHasAllTags(song, ['viejunas', 'infantiles'])).toBe(true);
    expect(songHasAllTags(song, ['viejunas', 'envio'])).toBe(false);
    expect(songHasAllTags(song, [])).toBe(false);
    expect(songHasAllTags({ title: 'x' }, ['viejunas'])).toBe(false);
  });
});

describe('buildTagIndex', () => {
  it('cuenta sobre los datos ya filtrados y ordena por uso', () => {
    const index = buildTagIndex(songsData);
    expect(index.tags.map((t) => [t.slug, t.count])).toEqual([
      ['viejunas', 3],
      ['envio', 1],
      ['infantiles', 1],
      ['mariana', 1],
    ]);
  });

  it('una etiqueta fuera del catálogo funciona igual, con el slug capitalizado', () => {
    const index = buildTagIndex(songsData);
    const envio = index.bySlug.get('envio');
    expect(envio?.label).toBe('Envio');
    expect(envio?.emoji).toBeUndefined();
    expect(envio?.destacada).toBe(false);
  });

  it('aplica el catálogo cuando existe', () => {
    const index = buildTagIndex(songsData, {
      viejunas: { label: 'Viejunas', emoji: '🕰️', destacada: true, orden: 1 },
    });
    const viejunas = index.bySlug.get('viejunas');
    expect(viejunas).toMatchObject({
      label: 'Viejunas',
      emoji: '🕰️',
      destacada: true,
      orden: 1,
      count: 3,
    });
  });

  it('colapsa los alias en una sola etiqueta', () => {
    const index = buildTagIndex(
      {
        cat: {
          categoryTitle: 'Cat',
          songs: [
            { title: 'a', tags: ['viejuna'] },
            { title: 'b', tags: ['viejunas'] },
          ],
        },
      },
      { viejunas: { label: 'Viejunas', alias: ['viejuna'] } },
    );
    expect(index.tags).toHaveLength(1);
    expect(index.tags[0]).toMatchObject({ slug: 'viejunas', count: 2 });
  });

  it('no saca etiquetas declaradas pero sin usar', () => {
    const index = buildTagIndex(songsData, {
      inexistente: { label: 'Inexistente' },
    });
    expect(index.bySlug.has('inexistente')).toBe(false);
  });

  it('sin datos devuelve un índice vacío', () => {
    expect(buildTagIndex(null).tags).toEqual([]);
    expect(buildTagIndex(undefined).tags).toEqual([]);
  });
});

describe('resolveTag', () => {
  it('se inventa la etiqueta a partir del slug si no está en el índice', () => {
    const index = buildTagIndex(songsData);
    expect(resolveTag('desconocida', index)).toEqual({
      slug: 'desconocida',
      label: 'Desconocida',
      count: 0,
      destacada: false,
    });
  });
});

describe('coOccurringTags', () => {
  it('solo ofrece etiquetas que darían resultados, y nunca las activas', () => {
    const index = buildTagIndex(songsData);
    const viejunas = [
      ...songsData.entrada.songs.slice(0, 2),
      songsData.maria.songs[0],
    ];
    const candidates = coOccurringTags(viejunas, ['viejunas'], index);
    expect(candidates.map((t) => t.slug)).toEqual(['envio', 'infantiles']);
    // El recuento es el del cruce, no el global.
    expect(candidates.every((t) => t.count === 1)).toBe(true);
    expect(candidates.some((t) => t.slug === 'mariana')).toBe(false);
  });

  it('respeta el límite', () => {
    const index = buildTagIndex(songsData);
    expect(coOccurringTags(songsData.entrada.songs, [], index, 1)).toHaveLength(
      1,
    );
  });
});

describe('tagCloudBucket', () => {
  it('reparte en tres tramos', () => {
    expect(tagCloudBucket(34, 2, 34)).toBe(1);
    expect(tagCloudBucket(15, 2, 34)).toBe(0);
    expect(tagCloudBucket(2, 2, 34)).toBe(-1);
  });

  it('con una sola etiqueta no hay tramo', () => {
    expect(tagCloudBucket(5, 5, 5)).toBe(0);
  });
});

describe('tagsTitle', () => {
  it('junta los labels de un cruce', () => {
    const index = buildTagIndex(songsData, {
      viejunas: { label: 'Viejunas' },
      infantiles: { label: 'Infantiles' },
    });
    expect(tagsTitle(['viejunas', 'infantiles'], index)).toBe(
      'Viejunas · Infantiles',
    );
  });
});

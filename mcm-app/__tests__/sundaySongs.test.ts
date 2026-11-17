/**
 * Motor de «Cantos para este domingo» (`utils/sundaySongs.ts`): las reglas
 * litúrgicas son filtros duros y cada una tiene su test; lo demás es
 * determinismo y degradación sin etiquetas.
 */
import { liturgicalDayOf } from '@/utils/liturgicalDay';
import {
  REMOVED,
  candidateWhy,
  massToSelection,
  nextCandidate,
  parseSundayPicks,
  pruneSundayPicks,
  shouldShowSundayCard,
  songMarks,
  suggestMass,
  withPick,
  type MomentSuggestion,
} from '@/utils/sundaySongs';
import type { SongEntry, SongsData } from '@/utils/filterSongsData';

const song = (
  filename: string,
  tags?: string[],
  extra: Partial<SongEntry> = {},
): SongEntry => ({ title: `Canto ${filename}`, filename, tags, ...extra });

const cat = (categoryTitle: string, songs: SongEntry[]) => ({
  categoryTitle,
  songs,
});

/** Un cantoral de juguete con varias canciones neutras por momento. */
function toyData(extra: Partial<Record<string, SongEntry[]>> = {}): SongsData {
  const neutral = (key: string, n: number) =>
    Array.from({ length: n }, (_, i) => song(`${key}${i + 1}`));
  return {
    entrada: cat('D. Entrada', [
      ...neutral('ent', 5),
      ...(extra.entrada ?? []),
    ]),
    salmos: cat('H. Salmos', [...neutral('sal', 4), ...(extra.salmos ?? [])]),
    aleluya: cat('B. Aleluya', [
      ...neutral('ale', 4),
      ...(extra.aleluya ?? []),
    ]),
    ofertorio: cat('F. Ofertorio', [
      ...neutral('ofe', 4),
      ...(extra.ofertorio ?? []),
    ]),
    santo: cat('I. Santo', [...neutral('san', 3), ...(extra.santo ?? [])]),
    comunion: cat('C. Comunión', [
      ...neutral('com', 5),
      ...(extra.comunion ?? []),
    ]),
    adoracion: cat('A. Adoración', [...(extra.adoracion ?? [])]),
    salida: cat('G. Salida', [...neutral('sli', 4), ...(extra.salida ?? [])]),
  };
}

const chosen = (mass: MomentSuggestion[]) =>
  mass.map((m) => m.candidates[m.chosenIndex]?.filename ?? null);
const byMoment = (mass: MomentSuggestion[], id: string) =>
  mass.find((m) => m.moment === id)!;

// 2026-11-22 Cristo Rey (TO) · 2026-03-15 IV Cuaresma · 2026-04-26 IV Pascua
// 2026-05-24 Pentecostés · 2026-11-29 I Adviento · 2026-03-29 Ramos
const REY = liturgicalDayOf('2026-11-22');
const CUARESMA = liturgicalDayOf('2026-03-15');
const PASCUA = liturgicalDayOf('2026-04-26');
const PENTECOSTES = liturgicalDayOf('2026-05-24');
const ADVIENTO = liturgicalDayOf('2026-11-29');

describe('suggestMass — forma', () => {
  it('siete momentos en orden de misa, uno elegido en cada uno', () => {
    const mass = suggestMass(REY, toyData());
    expect(mass.map((m) => m.moment)).toEqual([
      'entrada',
      'salmo',
      'aleluya',
      'ofertorio',
      'santo',
      'comunion',
      'salida',
    ]);
    expect(chosen(mass).every(Boolean)).toBe(true);
    expect(byMoment(mass, 'aleluya').label).toBe('Aleluya');
  });

  it('sin cantoral (null) o con categorías vacías no lanza: todo vacío con motivo', () => {
    for (const data of [null, undefined, {}]) {
      const mass = suggestMass(REY, data as never);
      expect(mass).toHaveLength(7);
      expect(mass.every((m) => m.chosenIndex === -1 && m.emptyReason)).toBe(
        true,
      );
    }
  });

  it('degrada bien sin NINGUNA etiqueta: sugiere neutras', () => {
    const mass = suggestMass(CUARESMA, toyData());
    const entrada = byMoment(mass, 'entrada');
    expect(entrada.candidates).toHaveLength(5);
    expect(entrada.candidates.every((c) => c.score === 0)).toBe(true);
    expect(entrada.candidates[0].reasons).toEqual([]);
  });

  it('una canción sin filename se ignora', () => {
    const data = toyData();
    data.entrada.songs.push({ title: 'Sin fichero' });
    expect(() => suggestMass(REY, data)).not.toThrow();
  });
});

describe('regla 1: sin Aleluya en Cuaresma', () => {
  it('el momento se llama Aclamación y solo admite aclamaciones o de Cuaresma', () => {
    const data = toyData({
      aleluya: [song('acl1', ['aclamacion']), song('cua1', ['cuaresma'])],
    });
    const mass = suggestMass(CUARESMA, data);
    const m = byMoment(mass, 'aleluya');
    expect(m.label).toBe('Aclamación');
    expect(m.candidates.map((c) => c.filename).sort()).toEqual([
      'acl1',
      'cua1',
    ]);
    // la de Cuaresma puntúa y va primero
    expect(m.candidates[0].filename).toBe('cua1');
    expect(m.candidates[0].reasons).toEqual(['Cuaresma']);
  });

  it('sin ninguna aclamación el momento sale vacío, no con un aleluya', () => {
    const m = byMoment(suggestMass(CUARESMA, toyData()), 'aleluya');
    expect(m.candidates).toEqual([]);
    expect(m.chosenIndex).toBe(-1);
    expect(m.emptyReason).toBe('Sin aclamación de Cuaresma en el cantoral');
  });

  it('nada con «Aleluya» en el título en ningún momento de Cuaresma', () => {
    const data = toyData({
      entrada: [song('ale-ent', undefined, { title: 'Cantemos: ¡Aleluya!' })],
      aleluya: [
        song('acl1', ['aclamacion'], { title: 'Aleluya, Aleluya' }),
        song('acl2', ['aclamacion'], { title: 'Gloria a ti, Señor' }),
      ],
    });
    const mass = suggestMass(CUARESMA, data);
    const all = mass.flatMap((m) => m.candidates.map((c) => c.filename));
    expect(all).not.toContain('ale-ent');
    expect(all).not.toContain('acl1');
    expect(byMoment(mass, 'aleluya').candidates.map((c) => c.filename)).toEqual(
      ['acl2'],
    );
  });

  it('Semana Santa (Ramos) tampoco lleva Aleluya', () => {
    const m = byMoment(
      suggestMass(liturgicalDayOf('2026-03-29'), toyData()),
      'aleluya',
    );
    expect(m.label).toBe('Aclamación');
  });

  it('fuera de Cuaresma el Aleluya vuelve a ser Aleluya y los de aclamación no se pierden', () => {
    const data = toyData({
      entrada: [song('ale-ent', undefined, { title: 'Aleluya, cantad' })],
    });
    const mass = suggestMass(PASCUA, data);
    expect(byMoment(mass, 'aleluya').label).toBe('Aleluya');
    expect(
      byMoment(mass, 'entrada').candidates.map((c) => c.filename),
    ).toContain('ale-ent');
  });
});

describe('regla 2: un tiempo fuerte distinto no entra', () => {
  const data = toyData({
    entrada: [
      song('villancico', ['navidad']),
      song('cuaresmal', ['cuaresma']),
      song('pascual', ['pascua']),
      song('pentecostal', ['pentecostes']),
    ],
  });

  it('un villancico no se sugiere en Pascua ni uno de Cuaresma en Navidad', () => {
    const files = (d: typeof PASCUA) =>
      byMoment(suggestMass(d, data), 'entrada').candidates.map(
        (c) => c.filename,
      );
    expect(files(PASCUA)).not.toContain('villancico');
    expect(files(PASCUA)).not.toContain('cuaresmal');
    expect(files(liturgicalDayOf('2026-12-27'))).not.toContain('cuaresmal');
    expect(files(liturgicalDayOf('2026-12-27'))).toContain('villancico');
  });

  it('una canción de fiesta solo entra ese día', () => {
    const files = (d: typeof PASCUA) =>
      byMoment(suggestMass(d, data), 'entrada').candidates.map(
        (c) => c.filename,
      );
    expect(files(PASCUA)).not.toContain('pentecostal');
    expect(files(PENTECOSTES)).toContain('pentecostal');
  });

  it('las neutras valen siempre', () => {
    for (const d of [REY, CUARESMA, PASCUA, ADVIENTO]) {
      const files = byMoment(suggestMass(d, data), 'entrada').candidates.map(
        (c) => c.filename,
      );
      expect(files).toEqual(expect.arrayContaining(['ent1', 'ent5']));
    }
  });
});

describe('regla 4: la fiesta manda sobre el tiempo', () => {
  it('Pentecostés (+5) antes que Pascua (+3) antes que neutra', () => {
    const data = toyData({
      entrada: [
        song('pascual', ['pascua']),
        song('pentecostal', ['pentecostes']),
      ],
    });
    const m = byMoment(suggestMass(PENTECOSTES, data), 'entrada');
    expect(m.candidates.slice(0, 2).map((c) => c.filename)).toEqual([
      'pentecostal',
      'pascual',
    ]);
    expect(m.candidates[0].score).toBe(5);
    expect(m.candidates[0].reasons).toEqual(['Pentecostés']);
    expect(m.candidates[1].score).toBe(3);
  });

  it('Cristo Rey > Tiempo Ordinario', () => {
    const data = toyData({
      entrada: [song('ord', ['ordinario']), song('rey', ['cristo-rey'])],
    });
    const m = byMoment(suggestMass(REY, data), 'entrada');
    expect(m.candidates[0].filename).toBe('rey');
    expect(m.candidates[0].reasons).toEqual(['Jesucristo, Rey del Universo']);
    expect(m.candidates[1].filename).toBe('ord');
  });
});

describe('regla 3: sin repetir canción entre momentos', () => {
  it('una canción de comunión etiquetada para el ofertorio sale solo una vez', () => {
    const data = toyData();
    // Una sola canción candidata en dos momentos, con puntos para ir la primera.
    data.comunion.songs = [song('doble', ['ofertorio', 'cuaresma'])];
    data.ofertorio.songs = [];
    const mass = suggestMass(CUARESMA, data);
    const files = chosen(mass).filter(Boolean);
    expect(new Set(files).size).toBe(files.length);
    expect(chosen(mass)[3]).toBe('doble'); // ofertorio va antes que comunión
    expect(byMoment(mass, 'comunion').candidates).toEqual([]);
  });

  it('un momento puede usar una canción de otra categoría por etiqueta', () => {
    const data = toyData({ entrada: [song('mariana1', ['mariana'])] });
    const salida = byMoment(suggestMass(REY, data), 'salida');
    expect(salida.candidates.map((c) => c.filename)).toContain('mariana1');
  });

  it('Adoración también alimenta la comunión', () => {
    const data = toyData({ adoracion: [song('adora1')] });
    const comunion = byMoment(suggestMass(REY, data), 'comunion');
    expect(comunion.candidates.map((c) => c.filename)).toContain('adora1');
  });
});

describe('determinismo y variedad', () => {
  const data = toyData();

  it('la misma fecha da la misma misa, siempre', () => {
    const a = chosen(suggestMass(REY, data));
    const b = chosen(suggestMass(liturgicalDayOf('2026-11-22'), toyData()));
    expect(a).toEqual(b);
  });

  it('el orden de las categorías en el dato no cambia el resultado', () => {
    const reversed: SongsData = Object.fromEntries(
      Object.entries(data).reverse(),
    );
    expect(chosen(suggestMass(REY, reversed))).toEqual(
      chosen(suggestMass(REY, data)),
    );
  });

  it('el domingo siguiente propone otra del mismo tramo, y da la vuelta', () => {
    const first = byMoment(
      suggestMass(liturgicalDayOf('2026-08-02'), data),
      'entrada',
    );
    const seen: string[] = [];
    let d = '2026-08-02';
    for (let i = 0; i < 5; i++) {
      const m = byMoment(suggestMass(liturgicalDayOf(d), data), 'entrada');
      seen.push(m.candidates[m.chosenIndex].filename);
      const next = new Date(`${d}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 7);
      d = next.toISOString().slice(0, 10);
    }
    expect(first.candidates).toHaveLength(5);
    // 5 domingos seguidos con 5 neutras: salen las 5, ninguna repetida…
    expect(new Set(seen).size).toBe(5);
    // …y el sexto domingo vuelve a la primera.
    const sixth = byMoment(suggestMass(liturgicalDayOf(d), data), 'entrada');
    expect(sixth.candidates[sixth.chosenIndex].filename).toBe(seen[0]);
  });

  it('un tramo con más puntos va siempre antes, aunque rote', () => {
    const tagged = toyData({
      entrada: [song('t1', ['ordinario']), song('t2', ['ordinario'])],
    });
    for (const f of ['2026-08-02', '2026-08-09', '2026-08-16']) {
      const m = byMoment(suggestMass(liturgicalDayOf(f), tagged), 'entrada');
      expect(['t1', 't2']).toContain(m.candidates[0].filename);
      expect(['t1', 't2']).toContain(m.candidates[1].filename);
      expect(m.candidates[2].score).toBe(0);
    }
  });
});

describe('lo que elige la persona', () => {
  const data = toyData();

  it('un filename guardado se respeta', () => {
    const base = suggestMass(REY, data);
    const target = byMoment(base, 'entrada').candidates[3].filename;
    const mass = suggestMass(REY, data, { picks: { entrada: target } });
    expect(chosen(mass)[0]).toBe(target);
  });

  it('un filename que ya no es candidato vuelve a la primera', () => {
    const mass = suggestMass(REY, data, { picks: { entrada: 'borrada' } });
    expect(mass[0].chosenIndex).toBe(0);
  });

  it('quitar un momento lo deja sin canción y libera la que habría usado', () => {
    const mass = suggestMass(REY, data, { picks: { entrada: REMOVED } });
    expect(mass[0].removed).toBe(true);
    expect(mass[0].chosenIndex).toBe(-1);
    expect(mass[0].candidates.length).toBeGreaterThan(0);
  });

  it('nextCandidate da la siguiente y da la vuelta', () => {
    const m = byMoment(suggestMass(REY, data), 'entrada');
    expect(nextCandidate(m)!.filename).toBe(m.candidates[1].filename);
    const last = { ...m, chosenIndex: m.candidates.length - 1 };
    expect(nextCandidate(last)!.filename).toBe(m.candidates[0].filename);
    expect(nextCandidate({ ...m, candidates: [] })).toBeUndefined();
  });

  it('elegir en un momento cambia lo que queda para los siguientes', () => {
    const d = toyData();
    d.comunion.songs = [song('compartida', ['ofertorio'])];
    d.ofertorio.songs = [song('compartida')];
    const mass = suggestMass(REY, d);
    expect(chosen(mass)[3]).toBe('compartida');
    expect(byMoment(mass, 'comunion').candidates).toEqual([]);
  });
});

describe('etiquetas ocultas', () => {
  it('con «esconder también sus canciones» salen fuera; sin él, no', () => {
    const data = toyData({
      entrada: [song('otra-casa', ['consolacion', 'cristo-rey'])],
    });
    const hiddenSlugs = new Set(['consolacion']);
    const on = byMoment(
      suggestMass(REY, data, { hiddenSlugs, hideHiddenTagSongs: true }),
      'entrada',
    );
    expect(on.candidates.map((c) => c.filename)).not.toContain('otra-casa');
    const off = byMoment(suggestMass(REY, data, { hiddenSlugs }), 'entrada');
    expect(off.candidates[0].filename).toBe('otra-casa');
  });

  it('los alias se resuelven antes de decidir', () => {
    const data = toyData({ entrada: [song('x', ['reyes-magos'])] });
    const marks = songMarks(data.entrada.songs.at(-1)!, {
      'reyes-magos': 'epifania',
    });
    expect([...marks.feasts]).toEqual(['epifania']);
  });
});

describe('tiempo litúrgico de la canción: etiquetas primero, liturgicalTime de respaldo', () => {
  it('las etiquetas mandan sobre liturgicalTime', () => {
    const marks = songMarks(
      song('a', ['adviento'], { liturgicalTime: 'Cuaresma' }),
    );
    expect([...marks.seasons]).toEqual(['adviento']);
  });

  it('sin etiquetas de tiempo, se lee liturgicalTime (sin tildes ni mayúsculas)', () => {
    expect([
      ...songMarks(song('a', [], { liturgicalTime: 'Tiempo de Pascua' }))
        .seasons,
    ]).toEqual(['pascua']);
    expect(
      [
        ...songMarks(
          song('a', undefined, { liturgicalTime: 'Cuaresma / Semana Santa' }),
        ).seasons,
      ].sort(),
    ).toEqual(['cuaresma', 'semana_santa']);
    expect([
      ...songMarks(song('a', undefined, { liturgicalTime: 'Pentecostés' }))
        .feasts,
    ]).toEqual(['pentecostes']);
  });

  it('una etiqueta que no es de tiempo (viejunas) no impide leer liturgicalTime', () => {
    const marks = songMarks(
      song('a', ['viejunas'], { liturgicalTime: 'Adviento' }),
    );
    expect([...marks.seasons]).toEqual(['adviento']);
  });

  it('texto libre sin significado litúrgico = neutra; «pascual» no es Pascua', () => {
    for (const t of ['Todo el año', '', 'cordero pascual']) {
      const m = songMarks(song('a', undefined, { liturgicalTime: t }));
      expect(m.seasons.size + m.feasts.size).toBe(0);
    }
  });

  it('el respaldo también filtra: una canción con liturgicalTime Navidad no sale en Pascua', () => {
    const data = toyData({
      entrada: [song('navi', undefined, { liturgicalTime: 'Navidad' })],
    });
    const files = byMoment(suggestMass(PASCUA, data), 'entrada').candidates.map(
      (c) => c.filename,
    );
    expect(files).not.toContain('navi');
  });
});

describe('«sin candidatas»', () => {
  it('si todas son de otro tiempo, lo dice distinto a «no hay canciones»', () => {
    const data = toyData();
    data.santo.songs = [song('santo-navidad', ['navidad'])];
    const m = byMoment(suggestMass(PASCUA, data), 'santo');
    expect(m.candidates).toEqual([]);
    expect(m.emptyReason).toBe(
      'Ninguna canción de santo encaja con este domingo',
    );
    data.santo.songs = [];
    expect(byMoment(suggestMass(PASCUA, data), 'santo').emptyReason).toBe(
      'No hay canciones de santo en el cantoral',
    );
  });
});

describe('shouldShowSundayCard (Inicio, de viernes a domingo)', () => {
  const tabs = ['index', 'cancionero', 'mas'];
  it('viernes, sábado y domingo con el tab del cantoral', () => {
    expect(shouldShowSundayCard('2026-11-20', tabs)).toBe(true); // viernes
    expect(shouldShowSundayCard('2026-11-21', tabs)).toBe(true);
    expect(shouldShowSundayCard('2026-11-22', tabs)).toBe(true);
  });
  it('de lunes a jueves no', () => {
    for (const f of ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19']) {
      expect(shouldShowSundayCard(f, tabs)).toBe(false);
    }
  });
  it('sin el tab del cantoral no', () => {
    expect(shouldShowSundayCard('2026-11-21', ['index', 'mas'])).toBe(false);
  });
});

describe('lo recordado por fecha', () => {
  it('parseSundayPicks tolera JSON roto, fechas falsas y momentos inventados', () => {
    expect(parseSundayPicks(null)).toEqual({});
    expect(parseSundayPicks('{no json')).toEqual({});
    expect(parseSundayPicks('[1,2]')).toEqual({});
    expect(
      parseSundayPicks(
        JSON.stringify({
          '2026-11-22': { entrada: 'ent2', inventado: 'x', salida: 7 },
          ayer: { entrada: 'a' },
          '2026-11-29': { salmo: 'quitado' },
          '2026-12-06': {},
        }),
      ),
    ).toEqual({
      '2026-11-22': { entrada: 'ent2' },
      '2026-11-29': { salmo: 'quitado' },
    });
  });

  it('pruneSundayPicks deja ±60 días y poda el resto', () => {
    const all = {
      '2026-01-01': { entrada: 'a' },
      '2026-09-17': { entrada: 'b' }, // 61 días antes: fuera
      '2026-09-18': { entrada: 'c' }, // 60: se queda
      '2026-11-22': { entrada: 'd' },
      '2027-01-16': { entrada: 'e' }, // 60 días después: se queda
      '2027-01-17': { entrada: 'f' }, // 61: fuera
    };
    expect(Object.keys(pruneSundayPicks(all, '2026-11-17'))).toEqual([
      '2026-09-18',
      '2026-11-22',
      '2027-01-16',
    ]);
  });

  it('withPick pone, quita y no deja fechas vacías ni muta lo anterior', () => {
    const a = withPick({}, '2026-11-22', 'entrada', 'ent2');
    expect(a).toEqual({ '2026-11-22': { entrada: 'ent2' } });
    const b = withPick(a, '2026-11-22', 'salida', REMOVED);
    expect(b['2026-11-22']).toEqual({ entrada: 'ent2', salida: 'quitado' });
    expect(a['2026-11-22']).toEqual({ entrada: 'ent2' });
    const c = withPick(
      withPick(b, '2026-11-22', 'entrada', null),
      '2026-11-22',
      'salida',
      null,
    );
    expect(c).toEqual({});
  });
});

describe('massToSelection', () => {
  it('las elegidas en orden de misa, con su categoría como pista', () => {
    const mass = suggestMass(REY, toyData(), { picks: { salmo: REMOVED } });
    const sel = massToSelection(mass, 1000);
    expect(sel.map((s) => s.order)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(sel.map((s) => s.categoryHint)).toEqual([
      'entrada',
      'aleluya',
      'ofertorio',
      'santo',
      'comunion',
      'salida',
    ]);
    expect(sel.every((s) => s.transpose === 0)).toBe(true);
    expect(sel.map((s) => s.filename)).toEqual(
      chosen(mass).filter((f): f is string => !!f),
    );
  });
  it('sin nada elegido, lista vacía', () => {
    expect(massToSelection(suggestMass(REY, null))).toEqual([]);
  });
});

describe('suggestMass — lecturas del domingo', () => {
  const READINGS = {
    lectura1: 'El pastor reunirá a sus ovejas dispersas en el monte.',
    salmo:
      'El Señor es mi pastor, nada me falta; en verdes praderas me hace recostar.',
    evangelio:
      'Yo soy el buen pastor que da la vida por las ovejas; conozco a mis ovejas.',
  };

  it('sin lecturas, la propuesta no cambia (rotación de siempre)', () => {
    expect(chosen(suggestMass(REY, toyData(), { readings: {} }))).toEqual(
      chosen(suggestMass(REY, toyData())),
    );
  });

  it('dentro del mismo tramo, la que comparte palabras con las lecturas va primero y dice por qué', () => {
    const data = toyData({
      entrada: [
        song('entPastor', undefined, {
          content: 'Tú eres mi pastor, tus ovejas te siguen al monte',
        }),
      ],
    });
    const entrada = byMoment(
      suggestMass(REY, data, { readings: READINGS }),
      'entrada',
    );
    const first = entrada.candidates[entrada.chosenIndex];
    expect(first.filename).toBe('entPastor');
    expect(first.reasons.join(' ')).toMatch(/^Lecturas: /);
  });

  it('el salmo se empareja con el salmo del día antes que con el resto', () => {
    const data = toyData({
      salmos: [
        song('salOvejas', undefined, {
          content: 'Ovejas dispersas en el monte vuelven',
        }),
        song('sal23', undefined, {
          content: 'El Señor es mi pastor, en verdes praderas me hace recostar',
        }),
      ],
    });
    const salmo = byMoment(
      suggestMass(REY, data, { readings: READINGS }),
      'salmo',
    );
    expect(salmo.candidates[salmo.chosenIndex].filename).toBe('sal23');
  });

  it('las lecturas no saltan las reglas litúrgicas: una de Adviento no entra en Cristo Rey', () => {
    const data = toyData({
      entrada: [
        song('entAdv', ['adviento'], {
          content: 'Pastor de tus ovejas, ven al monte',
        }),
      ],
    });
    const entrada = byMoment(
      suggestMass(REY, data, { readings: READINGS }),
      'entrada',
    );
    expect(entrada.candidates.map((c) => c.filename)).not.toContain('entAdv');
  });
});

describe('candidateWhy — el porqué en una frase', () => {
  const base = {
    filename: 'x',
    title: 'X',
    categoryKey: 'entrada',
    score: 0,
    song: { title: 'X', filename: 'x' },
  };
  it('las lecturas mandan', () => {
    expect(
      candidateWhy({
        ...base,
        reasons: ['Cuaresma', 'Lecturas: viña · pastor'],
        readingWords: ['viña', 'pastor'],
      }),
    ).toBe('Por las lecturas: viña, pastor');
  });
  it('sin lecturas, la fiesta o el tiempo; el Ordinario no se dice', () => {
    expect(
      candidateWhy({ ...base, reasons: ['Cuaresma'], readingWords: [] }),
    ).toBe('Cuaresma');
    expect(
      candidateWhy({
        ...base,
        reasons: ['Tiempo Ordinario'],
        readingWords: [],
      }),
    ).toBeNull();
  });
});

/**
 * Tests del paquete que la app deja escrito para los widgets de Contigo, y de
 * la racha que comparten con la pantalla.
 *
 * El widget no puede avisar de nada: si el paquete llega mal, pinta mal y en
 * silencio. Lo que se protege aquí es lo que se vería raro en la pantalla de
 * inicio de alguien — una racha que se rompe a medianoche sin haber fallado
 * un día, un evangelio de pasado mañana enseñado como el de mañana, o una
 * etiqueta HTML en mitad de la frase.
 */
import type { DayRecord } from '@/contexts/ContigoHabitsContext';
import { computeStreak } from '@/utils/contigoStreak';
import {
  GOSPEL_HOOK_MAX,
  WIDGET_PAYLOAD_VERSION,
  buildContigoWidgetPayload,
  gospelHook,
  streakTier,
} from '@/utils/contigoWidgetPayload';
import { offsetISODate } from '@/utils/localDate';

function day(
  date: string,
  done: Partial<Pick<DayRecord, 'readingDone' | 'prayerDone' | 'revisionDone'>>,
): DayRecord {
  return {
    date,
    readingDone: false,
    prayerDone: false,
    timestamp: 0,
    ...done,
  };
}

function prayedOn(...dates: string[]): Record<string, DayRecord> {
  return Object.fromEntries(
    dates.map((d) => [d, day(d, { prayerDone: true })]),
  );
}

describe('computeStreak', () => {
  it('hoy sin hacer todavía no rompe la racha: cuenta desde ayer', () => {
    const records = prayedOn('2026-09-24', '2026-09-25');
    expect(computeStreak(records, 'prayer', '2026-09-26')).toBe(2);
  });

  it('hoy hecho suma', () => {
    const records = prayedOn('2026-09-24', '2026-09-25', '2026-09-26');
    expect(computeStreak(records, 'prayer', '2026-09-26')).toBe(3);
  });

  it('un día saltado ayer la corta, aunque antes hubiera muchos', () => {
    const records = prayedOn(
      '2026-09-20',
      '2026-09-21',
      '2026-09-22',
      '2026-09-24',
    );
    expect(computeStreak(records, 'prayer', '2026-09-26')).toBe(0);
  });

  it('cruza el cambio de hora de octubre sin comerse ni duplicar un día', () => {
    // En España el 25 de octubre de 2026 el día tiene 25 horas.
    const records = prayedOn('2026-10-24', '2026-10-25', '2026-10-26');
    expect(computeStreak(records, 'prayer', '2026-10-26')).toBe(3);
  });

  it('cruza fin de mes y de año', () => {
    const records = prayedOn('2026-12-31', '2027-01-01');
    expect(computeStreak(records, 'prayer', '2027-01-01')).toBe(2);
    expect(offsetISODate('2027-03-01', -1)).toBe('2027-02-28');
  });

  it('cada hábito tiene su racha', () => {
    const records = {
      '2026-09-25': day('2026-09-25', {
        readingDone: true,
        revisionDone: true,
      }),
      '2026-09-26': day('2026-09-26', { readingDone: true }),
    };
    expect(computeStreak(records, 'reading', '2026-09-26')).toBe(2);
    expect(computeStreak(records, 'revision', '2026-09-26')).toBe(1);
    expect(computeStreak(records, 'prayer', '2026-09-26')).toBe(0);
  });
});

describe('streakTier', () => {
  it.each([
    [0, 'apagado'],
    [1, 'chispa'],
    [2, 'chispa'],
    [3, 'llama'],
    [6, 'llama'],
    [7, 'hoguera'],
    [29, 'hoguera'],
    [30, 'leyenda'],
    [400, 'leyenda'],
  ])('%i días → %s', (n, tier) => {
    expect(streakTier(n)).toBe(tier);
  });

  it('un número raro (negativo, NaN) se trata como sin racha', () => {
    expect(streakTier(-3)).toBe('apagado');
    expect(streakTier(NaN)).toBe('apagado');
  });
});

describe('gospelHook', () => {
  it('se queda con la primera frase y quita el HTML del scraper', () => {
    expect(
      gospelHook(
        '<p>En aquel tiempo, se acercaban a Jesús todos los publicanos.</p> <p>Y él les dijo...</p>',
      ),
    ).toBe('En aquel tiempo, se acercaban a Jesús todos los publicanos.');
  });

  it('una frase larga se corta por palabra, con puntos suspensivos y sin pasarse', () => {
    const long =
      'En aquel tiempo dijo Jesús a sus discípulos una parábola muy larga sobre un hombre que tenía cien ovejas y perdió una de ellas en el desierto';
    const hook = gospelHook(long)!;
    expect(hook.length).toBeLessThanOrEqual(GOSPEL_HOOK_MAX);
    expect(hook.endsWith('…')).toBe(true);
    // No parte una palabra: lo que hay antes de "…" es un final de palabra real.
    const lastWord = hook.slice(0, -1).split(' ').pop()!;
    expect(long.split(' ')).toContain(lastWord);
  });

  it('entidades y BBCode no se cuelan en la línea', () => {
    expect(gospelHook('[b]Dijo[/b]&nbsp;Jesús: &quot;Venid&quot;.')).toBe(
      'Dijo Jesús: "Venid".',
    );
  });

  it('no corta en los dos puntos de "dijo Jesús:", que no dicen nada', () => {
    expect(
      gospelHook(
        'En aquel tiempo, dijo Jesús a sus discípulos: «Amaos unos a otros». Y se fue.',
      ),
    ).toBe(
      'En aquel tiempo, dijo Jesús a sus discípulos: «Amaos unos a otros».',
    );
  });

  it('sin texto, o solo marcas, no hay gancho', () => {
    expect(gospelHook(undefined)).toBeNull();
    expect(gospelHook('')).toBeNull();
    expect(gospelHook('<p> </p>')).toBeNull();
  });
});

describe('buildContigoWidgetPayload', () => {
  const today = '2026-09-26';
  const readings = (cita: string, titulo?: string) => ({
    evangelio: {
      cita,
      texto: 'Dijo Jesús: «Venid a mí».',
      comentario: '',
      comentarista: '',
      url: '',
    },
    info: titulo ? { diaLiturgico: '', titulo } : undefined,
  });

  it('lleva los hábitos de HOY, el recuento y la racha de oración con su tramo', () => {
    const records = {
      ...prayedOn('2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'),
      [today]: day(today, { readingDone: true, prayerDone: true }),
    };
    const p = buildContigoWidgetPayload({
      records,
      today,
      readingsByDate: {},
      now: 123,
    });
    expect(p).toMatchObject({
      version: WIDGET_PAYLOAD_VERSION,
      generatedAt: 123,
      date: today,
      habits: { reading: true, prayer: true, revision: false },
      doneCount: 2,
      streak: 5,
      streakTier: 'llama',
    });
  });

  it('deja escritos varios días de evangelio para que cambie solo a medianoche', () => {
    const p = buildContigoWidgetPayload({
      records: {},
      today,
      readingsByDate: {
        '2026-09-26': readings('Lc 9, 43b-45', 'Sábado XXV'),
        '2026-09-27': readings('Lc 16, 19-31'),
        '2026-09-28': readings('Lc 9, 46-50'),
      },
    });
    expect(p.gospel.map((g) => g.date)).toEqual([
      '2026-09-26',
      '2026-09-27',
      '2026-09-28',
    ]);
    expect(p.gospel[0]).toEqual({
      date: '2026-09-26',
      ref: 'Lc 9, 43b-45',
      title: 'Sábado XXV',
      hook: 'Dijo Jesús: «Venid a mí».',
    });
    expect(p.gospel[1].title).toBeNull();
  });

  it('un hueco corta la serie: no enseña el de pasado mañana como si fuera mañana', () => {
    const p = buildContigoWidgetPayload({
      records: {},
      today,
      readingsByDate: {
        '2026-09-26': readings('Lc 9, 43b-45'),
        '2026-09-28': readings('Lc 9, 46-50'),
      },
    });
    expect(p.gospel.map((g) => g.date)).toEqual(['2026-09-26']);
  });

  it('sin lecturas de hoy (sin red, sin caché), el evangelio va vacío en vez de inventado', () => {
    const p = buildContigoWidgetPayload({
      records: {},
      today,
      readingsByDate: { '2026-09-26': { evangelio: undefined } },
    });
    expect(p.gospel).toEqual([]);
    expect(p.streakTier).toBe('apagado');
    expect(p.doneCount).toBe(0);
  });

  it('se puede serializar tal cual: es lo que lee el código nativo', () => {
    const p = buildContigoWidgetPayload({
      records: prayedOn(today),
      today,
      readingsByDate: { [today]: readings('Lc 9, 43b-45') },
      now: 1,
    });
    expect(JSON.parse(JSON.stringify(p))).toEqual(p);
  });
});

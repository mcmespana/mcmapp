/**
 * La regla de las piezas por asistencia (`utils/panueloAttendance.ts`): la
 * pieza sigue SIEMPRE a la asistencia, sin plazos. Es lógica pura que el día
 * de mañana se copia a la Cloud Function: si cambia, cambia el reparto.
 */
import fs from 'fs';
import path from 'path';

import type {
  PanueloAttendanceGrant,
  PanueloAward,
  PanueloCatalog,
  PanueloUserState,
} from '@/types/panuelo';
import {
  EMPTY_PANUELO,
  exampleViewerState,
  isTradeable,
  newPiecesQueue,
  newPiecesSections,
  pendingAutoGrants,
  reconcileAwards,
  revokedNoticeText,
  sanitizeAwards,
  sanitizeCatalog,
  sanitizeUserState,
} from '@/utils/panuelo';
import {
  attendanceEventIds,
  computeAwards,
  dayToMs,
  qualifies,
  type AttendanceAward,
  type AttendanceGrant,
  type AttendedEvents,
} from '@/utils/panueloAttendance';

const NOW = Date.UTC(2027, 4, 1);
const DAY_MS = 24 * 60 * 60 * 1000;

const CATALOG: PanueloCatalog = {
  'chapa-pascua': {
    id: 'chapa-pascua',
    kind: 'chapa',
    name: 'Chapa de Pascua',
    look: { kind: 'chapa', bg: '#ffffff' },
    // El mismo encuentro en dos delegaciones son dos eventos distintos.
    grant: { type: 'attendance', events: ['evt-pascua-v', 'evt-pascua-p'] },
  },
  'pin-tres-dias': {
    id: 'pin-tres-dias',
    kind: 'pin',
    name: 'Pin de los tres días',
    look: { kind: 'pin', shape: 'star', enamel: '#ffffff' },
    grant: {
      type: 'attendance',
      events: ['evt-campamento'],
      marks: ['yes'],
      minDays: 3,
    },
  },
  'chapa-codigo': {
    id: 'chapa-codigo',
    kind: 'chapa',
    name: 'Con código',
    look: { kind: 'chapa', bg: '#ffffff' },
    grant: { type: 'code', hash: 'a'.repeat(64) },
  },
};

describe('los tipos encajan con los de la app', () => {
  it('una concesión y un award de la app valen para la regla (y al revés)', () => {
    // Si alguien cambia uno de los dos lados, esto deja de compilar.
    const grant: PanueloAttendanceGrant = { type: 'attendance', events: ['x'] };
    const asRule: AttendanceGrant = grant;
    const award: PanueloAward = {
      at: 1,
      via: 'attendance',
      eventId: 'x',
      grantedAt: 1,
    };
    const asRuleAward: AttendanceAward = award;
    const back: PanueloAward = asRuleAward;
    expect([asRule, back]).toHaveLength(2);
  });

  it('no importa nada de la app: se puede copiar a functions/', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'utils', 'panueloAttendance.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/^import /m);
  });
});

describe('qué eventos se miran', () => {
  it('todos los de las piezas por asistencia, sin repetir', () => {
    expect(attendanceEventIds(CATALOG)).toEqual([
      'evt-campamento',
      'evt-pascua-p',
      'evt-pascua-v',
    ]);
  });
});

describe('qualifies', () => {
  const grant = { marks: undefined, minDays: undefined };
  it('«sí» o «parcial» en cualquier día del evento cuenta', () => {
    expect(qualifies(grant, [{ day: '2027-04-12', mark: 'partial' }])).toBe(
      '2027-04-12',
    );
    expect(
      qualifies(grant, [
        { day: '2027-04-13', mark: 'no_unjustified' },
        { day: '2027-04-12', mark: 'yes' },
      ]),
    ).toBe('2027-04-12');
  });

  it('las faltas, justificadas o no, no cuentan', () => {
    expect(
      qualifies(grant, [
        { day: '2027-04-12', mark: 'no_justified' },
        { day: '2027-04-13', mark: 'no_unjustified' },
      ]),
    ).toBeNull();
    expect(qualifies(grant, [])).toBeNull();
  });

  it('minDays cuenta días distintos con una marca que vale', () => {
    const three = { marks: ['yes' as const], minDays: 3 };
    const days = [
      { day: '2027-07-01', mark: 'yes' as const },
      { day: '2027-07-01', mark: 'yes' as const },
      { day: '2027-07-02', mark: 'partial' as const },
      { day: '2027-07-03', mark: 'yes' as const },
    ];
    expect(qualifies(three, days)).toBeNull();
    expect(
      qualifies(three, [...days, { day: '2027-07-04', mark: 'yes' }]),
    ).toBe('2027-07-01');
  });
});

describe('computeAwards', () => {
  it('con ir a uno de los eventos basta, y gana el día más temprano', () => {
    const { awards, granted, revoked } = computeAwards(
      CATALOG,
      {
        'evt-pascua-p': [{ day: '2027-04-14', mark: 'yes' }],
        'evt-pascua-v': [{ day: '2027-04-12', mark: 'yes' }],
      },
      {},
      NOW,
    );
    expect(granted).toEqual(['chapa-pascua']);
    expect(revoked).toEqual([]);
    expect(awards['chapa-pascua']).toEqual({
      at: dayToMs('2027-04-12'),
      via: 'attendance',
      eventId: 'evt-pascua-v',
      grantedAt: NOW,
    });
  });

  it('las marcas de eventos que nadie pide no dan nada', () => {
    const { awards } = computeAwards(
      CATALOG,
      { 'otro-evento': [{ day: '2027-04-12', mark: 'yes' }] },
      {},
      NOW,
    );
    expect(awards).toEqual({});
  });

  it('una marca tardía llega cuando llega: sin plazo, aunque sea un año después', () => {
    const before = computeAwards(CATALOG, {}, {}, NOW);
    expect(before.awards).toEqual({});
    const later = NOW + 365 * DAY_MS;
    const after = computeAwards(
      CATALOG,
      { 'evt-pascua-v': [{ day: '2027-04-12', mark: 'yes' }] },
      before.awards,
      later,
    );
    expect(after.granted).toEqual(['chapa-pascua']);
    expect(after.awards['chapa-pascua'].grantedAt).toBe(later);
    // `at` es el día del evento, no el de la reclamación.
    expect(after.awards['chapa-pascua'].at).toBe(dayToMs('2027-04-12'));
  });

  it('lo que se mantiene no cambia de fecha ni se vuelve a dar', () => {
    const first = computeAwards(
      CATALOG,
      { 'evt-pascua-v': [{ day: '2027-04-12', mark: 'yes' }] },
      {},
      NOW,
    );
    const again = computeAwards(
      CATALOG,
      { 'evt-pascua-v': [{ day: '2027-04-12', mark: 'yes' }] },
      first.awards,
      NOW + DAY_MS,
    );
    expect(again.granted).toEqual([]);
    expect(again.revoked).toEqual([]);
    expect(again.awards).toEqual(first.awards);
  });

  it.each([
    ['a los dos días', 2 * DAY_MS],
    ['a los dos años', 2 * 365 * DAY_MS],
  ])('si se corrige la lista, se quita %s', (_label, wait) => {
    const first = computeAwards(
      CATALOG,
      { 'evt-pascua-v': [{ day: '2027-04-12', mark: 'yes' }] },
      {},
      NOW,
    );
    const corrected = computeAwards(
      CATALOG,
      { 'evt-pascua-v': [{ day: '2027-04-12', mark: 'no_unjustified' }] },
      first.awards,
      NOW + wait,
    );
    expect(corrected.revoked).toEqual(['chapa-pascua']);
    expect(corrected.awards).toEqual({});
  });

  it('si vuelven a marcarla, llega como nueva', () => {
    const marked: AttendedEvents = {
      'evt-pascua-v': [{ day: '2027-04-12', mark: 'yes' }],
    };
    const first = computeAwards(CATALOG, marked, {}, NOW);
    const gone = computeAwards(CATALOG, {}, first.awards, NOW + DAY_MS);
    const back = computeAwards(CATALOG, marked, gone.awards, NOW + 2 * DAY_MS);
    expect(back.granted).toEqual(['chapa-pascua']);
    expect(back.awards['chapa-pascua'].grantedAt).toBe(NOW + 2 * DAY_MS);
  });

  it('retroactivo: asignar una pieza a un evento ya celebrado funciona igual', () => {
    const { granted } = computeAwards(
      CATALOG,
      { 'evt-pascua-v': [{ day: '2024-04-01', mark: 'partial' }] },
      {},
      NOW,
    );
    expect(granted).toEqual(['chapa-pascua']);
  });

  it('si la pieza sale del catálogo, su award se quita', () => {
    const first = computeAwards(
      CATALOG,
      { 'evt-pascua-v': [{ day: '2027-04-12', mark: 'yes' }] },
      {},
      NOW,
    );
    const { revoked } = computeAwards(
      {},
      { 'evt-pascua-v': [{ day: '2027-04-12', mark: 'yes' }] },
      first.awards,
      NOW,
    );
    expect(revoked).toEqual(['chapa-pascua']);
  });
});

describe('dayToMs', () => {
  it('a mediodía UTC, para no correrse de día; lo que no es un día, NaN', () => {
    expect(new Date(dayToMs('2027-04-12')).toISOString()).toBe(
      '2027-04-12T12:00:00.000Z',
    );
    expect(dayToMs('12/04/2027')).toBeNaN();
  });
});

const state = (over: Partial<PanueloUserState> = {}): PanueloUserState => ({
  ...EMPTY_PANUELO,
  ...over,
});

describe('piezas por asistencia en la app (utils/panuelo.ts)', () => {
  const catalog: PanueloCatalog = sanitizeCatalog({
    'chapa-pascua': {
      kind: 'chapa',
      name: 'Chapa de Pascua',
      origin: 'Pascua Joven 2027',
      description: 'Para quien vivió la Pascua.',
      rarity: 'especial',
      tradeable: true,
      look: { kind: 'chapa', bg: '#9D1E74' },
      grant: { type: 'attendance', events: ['evt-1', 'evt-1', ' evt-2 '] },
    },
    'pin-salida': {
      kind: 'pin',
      name: 'Pin de la salida',
      look: { kind: 'pin', shape: 'mountain', enamel: '#A3BD31' },
      grant: {
        type: 'attendance',
        events: ['evt-3'],
        marks: ['yes', 'raro'],
        minDays: 2.7,
      },
    },
    'chapa-normal': {
      kind: 'chapa',
      name: 'Normal',
      look: { kind: 'chapa', bg: '#ffffff' },
      grant: { type: 'all' },
    },
  });
  const award = (at: number, eventId = 'evt-1'): PanueloAward => ({
    at,
    via: 'attendance',
    eventId,
    grantedAt: at,
  });

  describe('sanear', () => {
    it('acepta la concesión: eventos sin repetir, marcas que existen, minDays entero', () => {
      expect(catalog['chapa-pascua'].grant).toEqual({
        type: 'attendance',
        events: ['evt-1', 'evt-2'],
      });
      expect(catalog['pin-salida'].grant).toEqual({
        type: 'attendance',
        events: ['evt-3'],
        marks: ['yes'],
        minDays: 2,
      });
    });

    it('nunca es intercambiable, aunque el catálogo diga que sí', () => {
      expect(catalog['chapa-pascua'].tradeable).toBe(false);
      expect(isTradeable(catalog['chapa-pascua'])).toBe(false);
      // Aunque llegara sin sanear con `tradeable: true`.
      expect(isTradeable({ ...catalog['chapa-pascua'], tradeable: true })).toBe(
        false,
      );
    });

    it('sin eventos no hay forma de conseguirla: la pieza se queda, sin concesión', () => {
      const out = sanitizeCatalog({
        vacia: {
          kind: 'chapa',
          name: 'Vacía',
          look: { kind: 'chapa', bg: '#ffffff' },
          grant: { type: 'attendance', events: [] },
        },
      });
      expect(out.vacia).toBeDefined();
      expect(out.vacia.grant).toBeUndefined();
    });

    it('las piezas por asistencia no se dan solas al abrir', () => {
      expect(
        pendingAutoGrants(catalog, EMPTY_PANUELO, NOW).map((i) => i.id),
      ).toEqual(['chapa-normal']);
    });

    it('los awards: lo que no tiene fecha o evento se descarta', () => {
      expect(
        sanitizeAwards({
          'chapa-pascua': { at: 5, eventId: 'evt-1', grantedAt: 6 },
          'sin-fecha': { eventId: 'evt-1' },
          'sin-evento': { at: 5 },
          'MAL ID': { at: 5, eventId: 'evt-1' },
          'sin-granted': { at: 7, eventId: 'evt-1' },
        }),
      ).toEqual({
        'chapa-pascua': { ...award(5), grantedAt: 6 },
        'sin-granted': award(7),
      });
      expect(sanitizeAwards(null)).toEqual({});
    });

    it('la vía «attendance» sobrevive al ida y vuelta por Firebase', () => {
      expect(
        sanitizeUserState({ items: { x: { at: 1, via: 'attendance' } } }).items
          .x.via,
      ).toBe('attendance');
    });
  });

  describe('reconcileAwards', () => {
    it('lo concedido entra en la caja, sin coserse', () => {
      const { state: next, granted } = reconcileAwards(
        state({ color: 'green' }),
        { 'chapa-pascua': award(100) },
        catalog,
        NOW,
      );
      expect(granted).toEqual(['chapa-pascua']);
      expect(next.items['chapa-pascua']).toEqual({
        at: 100,
        via: 'attendance',
      });
      expect(next.layout['chapa-pascua']).toBeUndefined();
    });

    it('un reflejo sin award no cuenta: se quita', () => {
      const { state: next, revoked } = reconcileAwards(
        state({ items: { 'chapa-pascua': { at: 1, via: 'attendance' } } }),
        {},
        catalog,
        NOW,
      );
      expect(revoked).toEqual(['chapa-pascua']);
      expect(next.items).toEqual({});
    });

    it('tampoco vale haberla apuntado con otra vía a mano', () => {
      const { revoked } = reconcileAwards(
        state({ items: { 'chapa-pascua': { at: 1, via: 'manual' } } }),
        {},
        catalog,
        NOW,
      );
      expect(revoked).toEqual(['chapa-pascua']);
    });

    it('una retirada cosida se descose y las demás no se mueven', () => {
      const before = state({
        items: {
          'chapa-pascua': { at: 1, via: 'attendance' },
          'chapa-normal': { at: 1, via: 'all' },
        },
        layout: {
          'chapa-pascua': { u: 0.1, v: 0.3, rot: 0 },
          'chapa-normal': { u: -0.2, v: 0.4, rot: 15 },
        },
        layoutAt: 5,
      });
      const { state: next, revoked } = reconcileAwards(
        before,
        {},
        catalog,
        NOW,
      );
      expect(revoked).toEqual(['chapa-pascua']);
      expect(next.layout).toEqual({
        'chapa-normal': { u: -0.2, v: 0.4, rot: 15 },
      });
      expect(next.layoutAt).toBe(NOW);
    });

    it('si vuelve, entra como nueva y otra vez a la caja (no a su sitio de antes)', () => {
      const sewn = state({
        items: { 'chapa-pascua': { at: 1, via: 'attendance' } },
        layout: { 'chapa-pascua': { u: 0.1, v: 0.3, rot: 0 } },
      });
      const gone = reconcileAwards(sewn, {}, catalog, NOW).state;
      const back = reconcileAwards(
        gone,
        { 'chapa-pascua': award(200) },
        catalog,
        NOW,
      );
      expect(back.granted).toEqual(['chapa-pascua']);
      expect(back.state.layout['chapa-pascua']).toBeUndefined();
    });

    it('no toca lo demás: piezas de otra vía y las de muestra del Laboratorio', () => {
      const before = state({
        items: {
          'chapa-normal': { at: 1, via: 'all' },
          'pin-salida': { at: 1, via: 'demo' },
        },
      });
      const result = reconcileAwards(before, {}, catalog, NOW);
      expect(result.state).toBe(before);
      expect(result.revoked).toEqual([]);
    });

    it('un award de una pieza que no es por asistencia (o no existe) no da nada', () => {
      const result = reconcileAwards(
        state(),
        { 'chapa-normal': award(1), fantasma: award(1) },
        catalog,
        NOW,
      );
      expect(result.granted).toEqual([]);
      expect(result.state.items).toEqual({});
    });

    it('con lo mismo que ya había devuelve el mismo objeto', () => {
      const before = state({
        items: { 'chapa-pascua': { at: 100, via: 'attendance' } },
      });
      expect(
        reconcileAwards(before, { 'chapa-pascua': award(100) }, catalog, NOW)
          .state,
      ).toBe(before);
    });
  });

  describe('el desvelado', () => {
    const owned = state({
      color: 'blue',
      items: {
        'chapa-pascua': { at: Date.UTC(2027, 3, 12, 12), via: 'attendance' },
        'pin-salida': { at: Date.UTC(2027, 3, 13, 12), via: 'attendance' },
        'chapa-normal': { at: 1, via: 'all' },
      },
      layout: { 'chapa-normal': { u: 0, v: 0.4, rot: 0 } },
    });

    it('esperan su desvelado las de asistencia sin ver y en la caja', () => {
      expect(
        newPiecesQueue(catalog, owned, [
          'chapa-normal',
          'chapa-pascua',
          'pin-salida',
        ]),
      ).toEqual(['chapa-pascua', 'pin-salida']);
      // Ya colocada (o ya vista): no.
      expect(
        newPiecesQueue(
          catalog,
          {
            ...owned,
            layout: { ...owned.layout, 'pin-salida': { u: 0, v: 0, rot: 0 } },
          },
          ['pin-salida'],
        ),
      ).toEqual([]);
    });

    it('una página por pieza: nombre, por qué, su ficha y la fecha', () => {
      const sections = newPiecesSections(catalog, owned, [
        'chapa-pascua',
        'pin-salida',
      ]);
      expect(sections.map((s) => s.title)).toEqual([
        'Chapa de Pascua',
        'Pin de la salida',
      ]);
      expect(sections[0].body).toBe('Por ir a Pascua Joven 2027.');
      expect(sections[1].body).toBe('Por ir a una actividad.');
      expect(sections[0].rows?.map((r) => r.title)).toEqual([
        'Chapa · Especial',
        'La conseguiste el 12 de abril de 2027',
      ]);
      expect(sections[0].rows?.[0].text).toBe('Para quien vivió la Pascua.');
      // La última dice dónde esperan.
      expect(sections[1].rows?.at(-1)?.title).toBe(
        'Te esperan en tu colección',
      );
      // El visor: el pañuelo de la persona y la pieza presentándose.
      expect(sections[1].example).toEqual({
        color: 'blue',
        pieces: ['pin-salida'],
        reveal: 'pin-salida',
      });
    });

    it('una sola pieza habla en singular', () => {
      const [only] = newPiecesSections(catalog, owned, ['chapa-pascua']);
      expect(only.rows?.at(-1)?.title).toBe('Te espera en tu colección');
    });

    it('el pañuelo de la persona no se mueve: la nueva va a un hueco libre', () => {
      const viewer = exampleViewerState(catalog, 'blue', ['pin-salida'], owned);
      const normal = viewer.items.find((i) => i.id === 'chapa-normal');
      expect(normal).toMatchObject({ u: 0, v: 0.4 });
      expect(viewer.items.map((i) => i.id).sort()).toEqual([
        'chapa-normal',
        'pin-salida',
      ]);
    });
  });
});

describe('revokedNoticeText', () => {
  it('una línea, con el nombre y de qué lista; nada si no hay nada', () => {
    expect(revokedNoticeText([])).toBeNull();
    expect(
      revokedNoticeText([{ id: 'a', name: 'Chapa', origin: 'Pascua' }]),
    ).toBe('Ya no tienes «Chapa»: se corrigió la lista de Pascua.');
    expect(revokedNoticeText([{ id: 'a', name: 'Chapa' }])).toBe(
      'Ya no tienes «Chapa»: se corrigió la lista.',
    );
    expect(
      revokedNoticeText([
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'c', name: 'C' },
      ]),
    ).toBe('Ya no tienes «A», «B» ni «C»: se corrigieron las listas.');
  });
});

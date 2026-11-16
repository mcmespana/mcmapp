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
} from '@/types/panuelo';
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

/**
 * Las habitaciones de un evento que se gestiona (plan 18), sin React: el
 * orden (alojamiento, planta y código natural), la ocupación con lo puesto a
 * mano en Comunica Tools, el orden del selector, la vista por plantas, el
 * deshacer y cómo se mezcla lo pendiente en la cola con lo que trae el sondeo.
 */
import type {
  ManagedEventDetail,
  ManagedRegistration,
  ManagedRoom,
} from '@/services/comunica/contract';
import { ManagedEventDetail as DetailSchema } from '@/services/comunica/contract';
import type { OutboxEntry } from '@/services/comunica/outbox';
import {
  CHECKIN_KIND,
  CHECKIN_ROOM_KIND,
  checkinRows,
  effectiveCheckins,
  pendingByRegistration,
  planCheckin,
  rejectedEntries,
  unsentCount,
  withCheckins,
} from '@/utils/comunica/checkin';
import {
  floorLabel,
  freeLabel,
  roomExtrasOf,
  roomOccupancy,
  roomOptionLabel,
  roomOptions,
  roomsByFloor,
  roomStats,
  roomTone,
  roomUndoGroups,
  sortRooms,
  unplacedPeople,
} from '@/utils/comunica/rooms';

const T0 = '2026-11-26T09:00:00Z';
const T1 = '2026-11-26T09:05:00Z';
const T2 = '2026-11-26T09:10:00Z';
const badges = { healthNote: false, noPhotos: false, notHomeAlone: false };
const VC = { id: 'd-vc', name: 'Villaclara' };

const reg = (
  n: number,
  first: string,
  last: string,
  extra: Partial<ManagedRegistration> = {},
): ManagedRegistration => ({
  registrationId: `r${n}`,
  personId: `p${n}`,
  firstName: first,
  lastName: last,
  schoolLevel: null,
  role: 'participant',
  delegation: VC,
  badges,
  ...extra,
});
const room = (
  id: string,
  code: string,
  capacity: number,
  floor: string | null,
  venue = 'Albergue',
): ManagedRoom => ({ id, code, capacity, floor, venue });

// Llegan desordenadas, como pueden llegar del servidor.
const rooms = [
  room('h10', '10', 2, '1'),
  room('h2', '2', 3, '1'),
  room('hb', 'B1', 2, 'Baja'),
  room('h21', '21', 2, '2'),
  room('hx', 'X', 4, null),
  room('ca', 'A', 2, null, 'Casa'),
];

const detail: ManagedEventDetail = DetailSchema.parse({
  generatedAt: T0,
  event: {
    id: 'ev',
    name: 'Encuentro',
    startDate: '2026-11-25',
    endDate: '2026-11-27',
    delegation: VC,
    registered: 6,
    arrived: 0,
  },
  registrations: [
    reg(1, 'Lucía', 'García'),
    reg(2, 'Hugo', 'Ábalos'),
    reg(3, 'Marta', 'Ibáñez'),
    reg(4, 'Nora', 'Zapata'),
    reg(5, 'Bruno', 'Cano'),
    reg(6, 'Iris', 'Moreno', { registrationStatus: 'cancelled' }),
  ],
  checkins: [
    { registrationId: 'r1', roomId: 'h2', updatedAt: T0 },
    { registrationId: 'r2', roomId: 'h2', updatedAt: T0 },
    // No viene, pero sigue ocupando su cama (como en Comunica Tools).
    { registrationId: 'r3', roomId: 'h10', absent: true, updatedAt: T0 },
    // Cancelada: no ocupa.
    { registrationId: 'r6', roomId: 'h10', updatedAt: T0 },
  ],
  since: T0,
  rooms,
  roomExtras: [
    { id: 'x1', roomId: 'h10', kind: 'person', label: 'Formador', seats: 1 },
    { id: 'x2', roomId: 'h21', kind: 'hold', label: 'Cocina', seats: 3 },
  ],
});
const eff = effectiveCheckins(detail, new Map());
const occ = roomOccupancy(detail, eff);

describe('el orden', () => {
  it('alojamiento (como llegan), planta y código natural; sin planta al final', () => {
    expect(sortRooms(rooms).map((r) => r.code)).toEqual([
      '2',
      '10',
      '21',
      'B1',
      'X',
      'A',
    ]);
    expect(floorLabel('1')).toBe('Planta 1');
    expect(floorLabel('Baja')).toBe('Baja');
    expect(floorLabel(null)).toBe('Sin planta');
  });
});

describe('la ocupación', () => {
  it('personas que cuentan más lo puesto a mano', () => {
    const at = (id: string) => {
      const u = occ.get(id)!;
      return [u.taken, u.capacity, u.tone];
    };
    expect(at('h2')).toEqual([2, 3, 'free']);
    // Marta (no viene) + el formador; la cancelada no.
    expect(at('h10')).toEqual([2, 2, 'full']);
    expect(at('h21')).toEqual([3, 2, 'over']);
    expect(at('hx')).toEqual([0, 4, 'empty']);
    // Por apellidos dentro.
    expect(occ.get('h2')!.people.map((p) => p.firstName)).toEqual([
      'Hugo',
      'Lucía',
    ]);
    expect(roomTone(1, 0)).toBe('over');
    expect(freeLabel({ taken: 1, capacity: 3 })).toBe('quedan 2');
    expect(freeLabel({ taken: 2, capacity: 3 })).toBe('queda 1');
    expect(freeLabel({ taken: 3, capacity: 3 })).toBe('llena');
    expect(freeLabel({ taken: 4, capacity: 3 })).toBe('se pasa 1');
  });

  it('un evento guardado antes de los extras (sin `roomExtras`) no falla', () => {
    const old = { ...detail } as Partial<ManagedEventDetail>;
    delete old.roomExtras;
    expect(roomExtrasOf(old as ManagedEventDetail)).toEqual([]);
    const o = roomOccupancy(old as ManagedEventDetail, eff);
    expect(o.get('h21')!.taken).toBe(0);
  });

  it('cifras y quién falta por colocar (sin los que no vienen)', () => {
    expect(roomStats(detail, eff, occ)).toEqual({
      rooms: 6,
      beds: 15,
      taken: 7,
      placed: 3,
      unplaced: 2,
      over: 1,
    });
    expect(unplacedPeople(detail, eff, occ).map((p) => p.firstName)).toEqual([
      'Bruno',
      'Nora',
    ]);
  });
});

describe('elegir habitación', () => {
  it('la última usada arriba, luego con gente y hueco, vacías y las que no caben', () => {
    const codes = (o: Parameters<typeof roomOptions>[1]) =>
      roomOptions(occ, o).map((x) => x.use.room.code);
    expect(codes({})).toEqual(['2', 'B1', 'X', 'A', '10', '21']);
    expect(codes({ last: 'hx' })).toEqual(['X', '2', 'B1', 'A', '10', '21']);
    // La última no sube si no cabe.
    expect(codes({ last: 'h10' })[0]).toBe('2');
    // Dos a la vez: en la 2 ya no caben.
    expect(codes({ adding: 2 })).toEqual(['B1', 'X', 'A', '2', '10', '21']);
  });

  it('la suya no suma: cabe aunque esté llena', () => {
    const o = roomOptions(occ, { current: 'h10' }).find(
      (x) => x.use.room.id === 'h10',
    )!;
    expect(o).toMatchObject({ current: true, fits: true, after: 2 });
    expect(roomOptionLabel(o, true)).toBe(
      'Habitación 10 · Planta 1 · Albergue: 2 de 2, la de ahora, dentro: Marta Ibáñez, Formador',
    );
  });

  it('busca por código, por planta y, con varios alojamientos, por casa', () => {
    const codes = (query: string) =>
      roomOptions(occ, { query }).map((x) => x.use.room.code);
    expect(codes('b 1')).toEqual(['B1']);
    expect(codes('p1')).toEqual(['2', '10']);
    expect(codes('planta 2')).toEqual(['21']);
    expect(codes('baj')).toEqual(['B1']);
    expect(codes('cas')).toEqual(['A']);
  });

  it('deshacer: cada uno a la suya de antes', () => {
    expect(roomUndoGroups(['r1', 'r2', 'r5', 'r3'], eff)).toEqual([
      { roomId: 'h2', ids: ['r1', 'r2'] },
      { roomId: null, ids: ['r5'] },
      { roomId: 'h10', ids: ['r3'] },
    ]);
  });
});

describe('la vista «Habitaciones»', () => {
  it('por alojamiento y planta, con sus plazas', () => {
    expect(
      roomsByFloor(occ).map((s) => [
        s.title,
        s.rooms.map((u) => u.room.code),
        `${s.taken}/${s.capacity}`,
      ]),
    ).toEqual([
      ['Albergue · Planta 1', ['2', '10'], '4/5'],
      ['Albergue · Planta 2', ['21'], '3/2'],
      ['Albergue · Baja', ['B1'], '0/2'],
      ['Albergue · Sin planta', ['X'], '0/4'],
      ['Casa · Sin planta', ['A'], '0/2'],
    ]);
  });
});

let seq = 0;
const entry = (
  kind: string,
  payload: unknown,
  patch: Partial<OutboxEntry> = {},
): OutboxEntry => ({
  key: `${kind}:ev:${++seq}`,
  kind,
  payload,
  clientId: `c${seq}`,
  meta: { eventId: 'ev' },
  status: 'pending',
  attempts: 0,
  createdAt: 0,
  updatedAt: 0,
  nextAttemptAt: 0,
  ...patch,
});

describe('la habitación por la cola', () => {
  it('lo pendiente manda sobre el sondeo hasta que sube', () => {
    const queue = [
      entry(CHECKIN_ROOM_KIND, { registrationIds: ['r1'], roomId: 'hx' }),
      entry(CHECKIN_ROOM_KIND, { registrationIds: ['r2'], roomId: null }),
    ];
    // El sondeo trae que a Lucía la han puesto en la 10 desde Comunica Tools.
    const polled = withCheckins(detail, [
      { registrationId: 'r1', roomId: 'h10', updatedAt: T1 },
    ]);
    const pending = pendingByRegistration(queue, 'ev');
    expect(pending.get('r1')).toEqual({ room: 'hx' });
    expect(pending.get('r2')).toEqual({ room: null });
    const e = effectiveCheckins(polled, pending);
    expect(e.get('r1')!.roomId).toBe('hx');
    expect(e.get('r2')!.roomId).toBeUndefined();
    expect(e.get('r1')!.queued).toBe(true);
    expect(unsentCount(queue, 'ev')).toBe(2);
    const rows = checkinRows(polled, e);
    expect(rows.find((r) => r.id === 'r1')!.room?.code).toBe('X');
    // Subida: lo del servidor (la respuesta) ya lo trae.
    const after = withCheckins(polled, [
      { registrationId: 'r1', roomId: 'hx', updatedAt: T2 },
    ]);
    const applied = queue.map((q) => ({ ...q, status: 'applied' as const }));
    expect(
      effectiveCheckins(after, pendingByRegistration(applied, 'ev')).get('r1')!
        .roomId,
    ).toBe('hx');
  });

  it('la llegada y la habitación no se pisan', () => {
    const queue = [
      entry(CHECKIN_KIND, { registrationIds: ['r5'], to: 'in', at: T1 }),
      entry(CHECKIN_ROOM_KIND, { registrationIds: ['r5'], roomId: 'hb' }),
    ];
    const e = effectiveCheckins(detail, pendingByRegistration(queue, 'ev'));
    expect(e.get('r5')).toMatchObject({
      status: 'in',
      arrivedAt: T1,
      roomId: 'hb',
    });
  });

  it('mover otra vez a alguien lo saca de la tanda de antes (solo de las de habitación)', () => {
    const queue = [
      entry(CHECKIN_ROOM_KIND, { registrationIds: ['r1', 'r2'], roomId: 'hx' }),
      entry(CHECKIN_KIND, { registrationIds: ['r1'], to: 'in', at: T1 }),
    ];
    const plan = planCheckin(queue, 'ev', ['r1'], CHECKIN_ROOM_KIND);
    expect(plan.remove).toEqual([]);
    expect(plan.update).toEqual([
      {
        key: queue[0].key,
        payload: { registrationIds: ['r2'], roomId: 'hx' },
      },
    ]);
  });

  it('una habitación que el servidor rechaza no se pinta y sale en el aviso', () => {
    const bad = entry(
      CHECKIN_ROOM_KIND,
      { registrationIds: ['r5'], roomId: 'otra' },
      {
        status: 'failed',
        error: {
          code: 'validation',
          reason: 'room_not_in_event',
          message: 'Esa habitación no es de este evento.',
          auto: false,
        },
      },
    );
    expect(pendingByRegistration([bad], 'ev').size).toBe(0);
    expect(rejectedEntries([bad], 'ev')).toEqual([bad]);
  });
});

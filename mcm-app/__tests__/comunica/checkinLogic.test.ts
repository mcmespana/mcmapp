/**
 * El check-in de un evento que se gestiona (plan 18), sin React: mezclar lo
 * que llega del sondeo, lo pendiente en la cola encima, las cifras, el
 * buscador por trozos, los filtros y los grupos, y cómo se reparten las tandas
 * en la cola al volver a marcar a alguien.
 */
import type {
  CheckinState,
  ManagedEventDetail,
  ManagedRegistration,
} from '@/services/comunica/contract';
import { ManagedEventDetail as DetailSchema } from '@/services/comunica/contract';
import type { OutboxEntry } from '@/services/comunica/outbox';
import {
  arrivedHeadline,
  arrivedOf,
  CHECKIN_KIND,
  CHECKIN_NOTE_KIND,
  checkinRows,
  checkinSections,
  checkinStats,
  classifyManaged,
  cleanNote,
  effectiveCheckins,
  filterChips,
  groupBysFor,
  matchesQuery,
  mergeCheckins,
  pendingByRegistration,
  pendingIn,
  planCheckin,
  rejectedEntries,
  restLine,
  roomHeading,
  withCheckins,
} from '@/utils/comunica/checkin';

const T0 = '2026-11-26T09:00:00Z';
const T1 = '2026-11-26T09:05:00Z';
const T2 = '2026-11-26T09:10:00Z';
const badges = { healthNote: false, noPhotos: false, notHomeAlone: false };
const VC = { id: 'd-vc', name: 'Villaclara' };
const PA = { id: 'd-pa', name: 'Puerto Alto' };
const ECE = { id: 'd-ece', name: 'ECE' };

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
  schoolLevel: { key: 'eso1', label: '1 ESO' },
  role: 'participant',
  delegation: VC,
  badges,
  ...extra,
});

const detail: ManagedEventDetail = DetailSchema.parse({
  generatedAt: T0,
  event: {
    id: 'ev',
    name: 'Encuentro',
    startDate: '2026-11-25',
    endDate: '2026-11-27',
    delegation: ECE,
    registered: 5,
    arrived: 1,
  },
  registrations: [
    reg(1, 'Lucía', 'García Pérez'),
    reg(2, 'Hugo', 'Ábalos Ruiz', {
      delegation: PA,
      schoolLevel: { key: 'eso2', label: '2 ESO' },
    }),
    reg(3, 'Marta', 'Ibáñez Soler', { role: 'monitor', schoolLevel: null }),
    reg(4, 'Nora', 'Zapata Gil', { role: 'team', delegation: ECE }),
    reg(5, 'Bruno', 'Cano Vidal', { delegation: null }),
    reg(6, 'Iris', 'Moreno Sanz', { registrationStatus: 'cancelled' }),
  ],
  checkins: [
    {
      registrationId: 'r1',
      arrivedAt: T0,
      arrivedBy: 'secretaria@ejemplo.org',
      roomId: 'h1',
      updatedAt: T0,
    },
    { registrationId: 'r2', absent: true, roomId: 'h2', updatedAt: T0 },
    {
      registrationId: 'r3',
      note: 'Llega tarde.',
      noteBy: 'Ana',
      updatedAt: T0,
    },
  ],
  since: T0,
  rooms: [
    { id: 'h1', code: '101', capacity: 4, floor: '1', venue: 'Albergue' },
    { id: 'h2', code: 'A', capacity: 2, floor: null, venue: 'Casa' },
  ],
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
const batch = (ids: string[], to: 'in' | 'absent' | 'pending', at = T1) =>
  entry(CHECKIN_KIND, { registrationIds: ids, to, at });

describe('lo del servidor', () => {
  it('el sondeo gana si es más nuevo y no pisa lo más nuevo que ya había', () => {
    const base: CheckinState[] = [
      { registrationId: 'a', arrivedAt: T1, updatedAt: T1 },
      { registrationId: 'b', updatedAt: T0 },
    ];
    const merged = mergeCheckins(base, [
      { registrationId: 'a', updatedAt: T0 }, // viejo: repetido del margen
      { registrationId: 'b', absent: true, updatedAt: T2 },
      { registrationId: 'c', arrivedAt: T2, updatedAt: T2 },
    ]);
    const by = new Map(merged.map((c) => [c.registrationId, c]));
    expect(by.get('a')!.arrivedAt).toBe(T1);
    expect(by.get('b')!.absent).toBe(true);
    expect(by.get('c')!.arrivedAt).toBe(T2);
  });

  it('el `since` solo avanza', () => {
    expect(withCheckins(detail, [], T2).since).toBe(T2);
    expect(withCheckins({ ...detail, since: T2 }, [], T1).since).toBe(T2);
    expect(withCheckins(detail, []).since).toBe(T0);
  });
});

describe('lo de la cola, encima', () => {
  it('lo último de cada inscripción gana; lo rechazado y lo subido no cuentan', () => {
    const entries = [
      batch(['r1', 'r5'], 'in'),
      batch(['r1'], 'pending', T2),
      entry(CHECKIN_NOTE_KIND, { registrationId: 'r5', note: 'Trae saco' }),
      batch(['r2'], 'in', T1),
      batch(['r4'], 'in', T1),
    ];
    entries[3].status = 'applied';
    entries[4].status = 'failed';
    entries[4].error = { code: 'forbidden', message: 'No', auto: false };
    const p = pendingByRegistration(entries, 'ev');
    expect(p.get('r1')).toEqual({ to: 'pending', at: T2 });
    expect(p.get('r5')).toEqual({ to: 'in', at: T1, note: 'Trae saco' });
    expect(p.has('r2')).toBe(false);
    expect(p.has('r4')).toBe(false);
    expect(rejectedEntries(entries, 'ev')).toHaveLength(1);
    // Otro evento no se mezcla.
    expect(pendingByRegistration(entries, 'otro').size).toBe(0);
  });

  it('el estado que se pinta: servidor + cola, con quien marca en el móvil', () => {
    const p = pendingByRegistration(
      [
        batch(['r5'], 'in', T2),
        batch(['r1'], 'pending'),
        entry(CHECKIN_NOTE_KIND, { registrationId: 'r3', note: '' }),
      ],
      'ev',
    );
    const eff = effectiveCheckins(detail, p, 'Pepe Gestor');
    expect(eff.get('r5')).toMatchObject({
      status: 'in',
      arrivedAt: T2,
      arrivedBy: 'Pepe Gestor',
      queued: true,
    });
    // Deshacer la llegada conserva la habitación.
    expect(eff.get('r1')).toMatchObject({
      status: 'pending',
      roomId: 'h1',
      queued: true,
    });
    expect(eff.get('r1')!.arrivedAt).toBeUndefined();
    // Una nota vacía en la cola borra la del servidor.
    expect(eff.get('r3')!.note).toBeUndefined();
    expect(eff.get('r2')).toMatchObject({ status: 'absent', queued: false });
  });

  it('volver a marcar saca a la persona de las tandas sin subir', () => {
    const a = batch(['r1', 'r2', 'r3'], 'in');
    const b = batch(['r4'], 'absent');
    const done = batch(['r1'], 'in');
    done.status = 'applied';
    const plan = planCheckin([a, b, done], 'ev', ['r1', 'r4']);
    expect(plan.remove).toEqual([b.key]);
    expect(plan.update).toEqual([
      {
        key: a.key,
        payload: { registrationIds: ['r2', 'r3'], to: 'in', at: T1 },
      },
    ]);
  });
});

describe('cómo se ve', () => {
  const eff = effectiveCheckins(detail, new Map());
  const rows = checkinRows(detail, eff);

  it('cifras: sin las canceladas', () => {
    const s = checkinStats(detail.registrations, eff);
    expect(s).toEqual({
      total: 5,
      arrived: 1,
      absent: 1,
      pending: 3,
      withNote: 1,
    });
    expect(arrivedHeadline(s)).toEqual({
      figure: '1 / 5',
      text: 'han llegado',
      ratio: 0.2,
    });
    expect(restLine(s)).toBe('3 faltan · 1 no viene');
    expect(arrivedHeadline({ arrived: 0, total: 0 }).ratio).toBe(0);
  });

  it('busca sin tildes y por trozos', () => {
    const lucia = rows.find((r) => r.id === 'r1')!;
    expect(matchesQuery(lucia.haystack, 'lucia')).toBe(true);
    expect(matchesQuery(lucia.haystack, 'lu gar')).toBe(true);
    expect(matchesQuery(lucia.haystack, 'gar lu')).toBe(true);
    expect(matchesQuery(lucia.haystack, 'hab 101')).toBe(true);
    expect(matchesQuery(lucia.haystack, 'lu zap')).toBe(false);
    const hugo = rows.find((r) => r.id === 'r2')!;
    expect(matchesQuery(hugo.haystack, 'abalos puerto')).toBe(true);
    expect(
      matchesQuery(rows.find((r) => r.id === 'r3')!.haystack, 'tarde'),
    ).toBe(true);
  });

  it('los chips cuentan lo activo', () => {
    expect(filterChips(rows).map((c) => [c.key, c.count])).toEqual([
      ['all', 5],
      ['pending', 3],
      ['in', 1],
      ['absent', 1],
      ['note', 1],
    ]);
  });

  it('por nombre: una sección y «No van» aparte, al final', () => {
    const s = checkinSections(rows, {});
    expect(s.map((x) => [x.title, x.count])).toEqual([
      ['Inscritos', 5],
      ['No van', 1],
    ]);
    // Por apellidos, sin acentos: Ábalos primero.
    expect(s[0].rows[0].reg.lastName).toBe('Ábalos Ruiz');
    expect(s[1].rows[0].outLabel).toBe('Cancelada');
    // Con un filtro de llegada, las canceladas no salen.
    expect(
      checkinSections(rows, { filter: 'pending' }).map((x) => x.title),
    ).toEqual(['Inscritos']);
  });

  it('por delegación: la dueña primero y «Sin delegación» al final', () => {
    const s = checkinSections(rows, {
      groupBy: 'delegation',
      event: detail.event,
    });
    expect(s.map((x) => x.title)).toEqual([
      'ECE',
      'Puerto Alto',
      'Villaclara',
      'Sin delegación',
      'No van',
    ]);
  });

  it('por curso: los cursos en orden y monitores y equipo detrás', () => {
    const s = checkinSections(rows, { groupBy: 'course' });
    expect(s.map((x) => [x.title, x.count])).toEqual([
      ['1 ESO', 2],
      ['2 ESO', 1],
      ['Monitores y equipo', 2],
      ['No van', 1],
    ]);
  });

  it('por papel y por habitación (con el título que se entiende solo)', () => {
    expect(
      checkinSections(rows, { groupBy: 'role' }).map((x) => x.title),
    ).toEqual(['Participantes', 'Monitores', 'Equipo', 'No van']);
    const h = checkinSections(rows, {
      groupBy: 'room',
      rooms: detail.rooms,
    });
    expect(h.map((x) => [x.title, x.count])).toEqual([
      ['Habitación 101 · planta 1 · Albergue', 1],
      ['Habitación A · Casa', 1],
      ['Sin habitación', 3],
      ['No van', 1],
    ]);
    expect(roomHeading(detail.rooms[0], false)).toBe(
      'Habitación 101 · planta 1',
    );
    expect(groupBysFor([])).not.toContain('room');
    expect(groupBysFor(detail.rooms)).toContain('room');
  });

  it('«los que faltan aquí» son solo los que se ven y faltan', () => {
    expect(pendingIn(checkinSections(rows, { query: 'lu' }))).toEqual([]);
    expect(pendingIn(checkinSections(rows, {})).sort()).toEqual([
      'r3',
      'r4',
      'r5',
    ]);
  });
});

describe('notas y lista de eventos', () => {
  it('la nota se limpia como en Comunica Tools', () => {
    expect(cleanNote('  hola   que\ntal  ')).toBe('hola que tal');
    expect(cleanNote('x'.repeat(400))).toHaveLength(300);
  });

  it('hoy, próximos y pasados', () => {
    const ev = (id: string, startDate: string, endDate: string) => ({
      id,
      name: id,
      startDate,
      endDate,
      delegation: ECE,
      registered: 3,
      arrived: 1,
    });
    const b = classifyManaged(
      [
        ev('lejos', '2026-12-20', '2026-12-22'),
        ev('hoy', '2026-11-25', '2026-11-27'),
        ev('cerca', '2026-12-01', '2026-12-01'),
        ev('ayer', '2026-11-20', '2026-11-25'),
        ev('antes', '2026-11-01', '2026-11-02'),
      ],
      '2026-11-26',
    );
    expect(b.today.map((e) => e.id)).toEqual(['hoy']);
    expect(b.upcoming.map((e) => e.id)).toEqual(['cerca', 'lejos']);
    expect(b.past.map((e) => e.id)).toEqual(['ayer', 'antes']);
    expect(arrivedOf({ arrived: 1, registered: 3 })).toBe('1/3 han llegado');
    expect(arrivedOf({ arrived: 0, registered: 0 })).toBe('Sin inscritos');
  });
});

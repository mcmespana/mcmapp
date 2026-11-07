// services/comunica/fake/fixturesEvents.ts
//
// Los eventos del servidor falso para pasar lista (plan 07 «Servidor falso»).
// Van aparte y se generan contra el «hoy» del falso la primera vez que se
// piden: el Laboratorio Alpha tiene SIEMPRE una convivencia que empieza hoy,
// sea el día que sea. Con su propia semilla: no mueven los datos de antes.
//
// En la delegación A (Villaclara): una convivencia que empieza hoy (dos días,
// con sesiones y grupos de actividad), una excursión de hoy sin sesiones,
// próximos, pasados (uno con grupos anulados con gente) y los que no deben
// salir: uno de 60 días, el semanal y uno de la delegación B.

import type {
  ActivityType,
  EventRole,
  MarkEntry,
  NotGoingStatus,
} from '../contract';
import { addDays, madridInstant } from '@/utils/comunica/madrid';
import type { FakeData, FakePerson, FakeSession } from './fixtures';
import { seededRandom } from './fixtures';

const EVENT_SEED = 7_2026_10;

export interface FakeLabEvent {
  id: string;
  name: string;
  delegationId: string;
  startDay: string;
  endDay: string;
  /** Hora de inicio y de fin («10:00», «18:00»). */
  startTime: string;
  endTime: string;
  /** Semanal o de reuniones: nunca sale. */
  recurring?: boolean;
}

export interface FakeRegistration {
  personId: string;
  role: EventRole;
  /** `null` = confirmada o vacía: se marca. */
  status: NotGoingStatus | null;
  /** El curso de la inscripción, si lo pusieron (manda sobre la relación). */
  schoolLevel?: string;
  /** Para elegir entre dos de la misma persona: la más reciente. */
  createdAt: string;
}

export interface FakeActivityGroup {
  id: string;
  eventId: string;
  name: string;
  type: ActivityType;
  batch: string | null;
  capacity: number | null;
  withMonitors: boolean;
  /** Anulado: solo se ve con el evento terminado y alguien dentro. */
  active: boolean;
}

export interface FakeActivityMember {
  groupId: string;
  role: 'monitor' | 'participant';
  personId: string | null;
  name: string;
}

export interface FakeEventData {
  /** El «hoy» con el que se generaron. */
  anchor: string;
  events: FakeLabEvent[];
  registrations: Record<string, FakeRegistration[]>;
  sessions: FakeSession[];
  /** sessionId → personId → marca. */
  marks: Record<string, Record<string, MarkEntry>>;
  groups: FakeActivityGroup[];
  members: FakeActivityMember[];
  /** Gente que solo sale en los eventos (sin curso, sin etapa…). */
  people: FakePerson[];
}

const D1 = 'f-del-villaclara';
const D2 = 'f-del-puertoalto';

/** Una sesión dura una hora (`sticpa_pl_ev_sesion_del_dia`). */
export const sessionTimes = (day: string, hhmm: string) => {
  const startsAt = madridInstant(day, hhmm);
  const endsAt = new Date(Date.parse(startsAt) + 3_600_000)
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z');
  return { startsAt, endsAt };
};

export function generateEventData(
  data: FakeData,
  today: string,
): FakeEventData {
  const rand = seededRandom(EVENT_SEED);
  const shuffle = <T>(list: readonly T[]) =>
    [...list]
      .map((x) => [rand(), x] as const)
      .sort((a, b) => a[0] - b[0])
      .map(([, x]) => x);

  const day = (n: number) => addDays(today, n);
  const events: FakeLabEvent[] = [
    {
      id: 'f-ev-convivencia',
      name: 'Convivencia de otoño',
      delegationId: D1,
      startDay: day(0),
      endDay: day(1),
      startTime: '10:00',
      endTime: '18:00',
    },
    {
      id: 'f-ev-excursion',
      name: 'Excursión a la sierra del MIC',
      delegationId: D1,
      startDay: day(0),
      endDay: day(0),
      startTime: '09:00',
      endTime: '19:00',
    },
    {
      id: 'f-ev-retiro',
      name: 'Retiro de LC',
      delegationId: D1,
      startDay: day(9),
      endDay: day(10),
      startTime: '17:00',
      endTime: '14:00',
    },
    {
      id: 'f-ev-navidad',
      name: 'Campamento de Navidad',
      delegationId: D1,
      startDay: day(30),
      endDay: day(33),
      startTime: '10:00',
      endTime: '13:00',
    },
    {
      id: 'f-ev-inicio',
      name: 'Salida de inicio de curso',
      delegationId: D1,
      startDay: day(-18),
      endDay: day(-17),
      startTime: '09:30',
      endTime: '18:00',
    },
    {
      id: 'f-ev-olimpiadas',
      name: 'Olimpiadas del MIC',
      delegationId: D1,
      startDay: day(-25),
      endDay: day(-25),
      startTime: '10:00',
      endTime: '14:00',
    },
    {
      id: 'f-ev-familias',
      name: 'Fiesta de las familias',
      delegationId: D1,
      startDay: day(16),
      endDay: day(16),
      startTime: '11:00',
      endTime: '15:00',
    },
    {
      id: 'f-ev-encuentro',
      name: 'Encuentro COM II',
      delegationId: D1,
      startDay: day(-9),
      endDay: day(-8),
      startTime: '16:00',
      endTime: '13:00',
    },
    {
      id: 'f-ev-voluntariado',
      name: 'Jornada de voluntariado',
      delegationId: D1,
      startDay: day(23),
      endDay: day(23),
      startTime: '09:00',
      endTime: '13:00',
    },
    // Los que NO salen.
    {
      id: 'f-ev-largo',
      name: 'Proyecto solidario del trimestre',
      delegationId: D1,
      startDay: day(-20),
      endDay: day(40),
      startTime: '10:00',
      endTime: '12:00',
    },
    {
      id: 'f-ev-semanal',
      name: 'Sesiones semanales (copia)',
      delegationId: D1,
      startDay: day(-2),
      endDay: day(5),
      startTime: '16:30',
      endTime: '18:00',
      recurring: true,
    },
    {
      id: 'f-ev-ajeno',
      name: 'Convivencia de Puerto Alto',
      delegationId: D2,
      startDay: day(0),
      endDay: day(1),
      startTime: '10:00',
      endTime: '18:00',
    },
  ];

  const groupsOf = (did: string) =>
    data.groups.filter((g) => g.delegationId === did);
  const participantsOf = (code: string) =>
    data.groups.find((g) => g.code === code)?.participantIds ?? [];
  const monitorsD1 = [...new Set(groupsOf(D1).flatMap((g) => g.monitorIds))];
  const d2 = groupsOf(D2).flatMap((g) => g.participantIds);

  // Gente que solo vive aquí: sin curso, y sin curso ni grupo ni etapa.
  const people: FakePerson[] = [
    {
      id: 'f-per-ev-01',
      firstName: 'Íñigo',
      lastName: 'Ábalos Muñoz',
      badges: { healthNote: false, noPhotos: false, notHomeAlone: false },
      delegationId: D1,
    },
    {
      id: 'f-per-ev-02',
      firstName: 'Nuria',
      lastName: 'Ñúñez Peña',
      schoolLevel: 'Universitario',
      badges: { healthNote: false, noPhotos: true, notHomeAlone: false },
      delegationId: D1,
    },
  ];

  const reg = (
    personId: string,
    role: EventRole = 'participant',
    status: NotGoingStatus | null = null,
    createdAt = '2026-09-20T10:00:00Z',
  ): FakeRegistration => ({ personId, role, status, createdAt });

  // ── La convivencia: COM entero y un MIC, tres de B, monitores de tres
  // maneras, «equipo», canceladas, rechazada y una con dos inscripciones.
  const com = ['C1', 'C2', 'C3'].flatMap(participantsOf);
  const mic = participantsOf('M2');
  const convPeople = [...shuffle(com).slice(0, 28), ...mic.slice(0, 4)];
  const conv: FakeRegistration[] = convPeople.map((id) => reg(id));
  conv.push(...d2.slice(0, 3).map((id) => reg(id)));
  conv.push(reg('f-per-ev-01'), reg('f-per-ev-02'));
  // Monitores: dos por inscripción (organizador), uno por su relación (se
  // inscribió como participante) y uno de «equipo».
  conv.push(reg(monitorsD1[0], 'monitor'), reg(monitorsD1[1], 'monitor'));
  conv.push(reg(monitorsD1[2]));
  conv.push(reg(monitorsD1[3], 'team'));
  // No van.
  const notGoing = shuffle(com.filter((id) => !convPeople.includes(id)));
  conv.push(reg(notGoing[0], 'participant', 'cancelled'));
  conv.push(reg(notGoing[1], 'participant', 'cancelled'));
  conv.push(reg(notGoing[2], 'participant', 'rejected'));
  conv.push(reg(notGoing[3], 'participant', 'did_not_take_part'));
  // Una cancelada vieja y una activa: sale una vez, en la lista.
  conv.push(
    reg(convPeople[0], 'participant', 'cancelled', '2026-09-01T10:00:00Z'),
  );

  // ── La excursión de hoy (MIC, sin sesiones).
  const exc = [...participantsOf('M1'), ...participantsOf('M2').slice(4)].map(
    (id) => reg(id),
  );
  exc.push(reg(monitorsD1[4] ?? monitorsD1[0], 'monitor'));

  // ── Los demás: unos pocos, para que no estén vacíos.
  const some = (ids: readonly string[], n: number) =>
    shuffle(ids)
      .slice(0, n)
      .map((id) => reg(id));
  const registrations: Record<string, FakeRegistration[]> = {
    'f-ev-convivencia': conv,
    'f-ev-excursion': exc,
    'f-ev-retiro': [],
    'f-ev-navidad': some(com, 18),
    'f-ev-inicio': [...some(com, 22), reg(monitorsD1[0], 'monitor')],
    'f-ev-olimpiadas': some(
      [...participantsOf('M1'), ...participantsOf('M2')],
      16,
    ),
    'f-ev-familias': some(com, 9),
    'f-ev-encuentro': some(participantsOf('C3'), 10),
    'f-ev-voluntariado': some(com, 6),
    'f-ev-largo': some(com, 5),
    'f-ev-semanal': [],
    'f-ev-ajeno': d2.map((id) => reg(id)),
  };

  // ── Sesiones: la convivencia, un día por día; los pasados, también.
  const sessions: FakeSession[] = [];
  const sessionOf = (eventId: string, d: string, time: string) => {
    const s: FakeSession = {
      id: `f-ses-${eventId.slice(5)}-${sessions.length + 1}`,
      eventId,
      date: d,
      ...sessionTimes(d, time),
      kind: 'event',
      delegationId: D1,
      stage: null,
    };
    sessions.push(s);
    return s;
  };
  sessionOf('f-ev-convivencia', day(0), '10:00');
  sessionOf('f-ev-convivencia', day(1), '09:00');
  const past1 = sessionOf('f-ev-inicio', day(-18), '09:30');
  const past2 = sessionOf('f-ev-inicio', day(-17), '09:00');
  sessionOf('f-ev-olimpiadas', day(-25), '10:00');
  sessionOf('f-ev-encuentro', day(-9), '16:00');
  sessionOf('f-ev-navidad', day(30), '10:00');

  // Lo pasado, pasado: casi todos vinieron.
  const marks: Record<string, Record<string, MarkEntry>> = {};
  for (const s of [past1, past2]) {
    marks[s.id] = {};
    for (const r of registrations['f-ev-inicio']) {
      const x = rand();
      marks[s.id][r.personId] =
        x < 0.85
          ? { mark: 'yes' }
          : x < 0.92
            ? { mark: 'no_justified', reason: 'Estaba enfermo' }
            : { mark: 'no_unjustified' };
    }
  }

  // ── Grupos de actividad de la convivencia: «Patrullas» (con monitor, una
  // vacía y un monitor que no se inscribió) y «Habitaciones» (con plazas, una
  // pasada de cupo). Y los de la salida pasada, anulados con gente.
  const groups: FakeActivityGroup[] = [];
  const members: FakeActivityMember[] = [];
  const nameOf = (id: string) => {
    const p =
      data.people.find((x) => x.id === id) ?? people.find((x) => x.id === id);
    return p ? `${p.firstName} ${p.lastName}` : '';
  };
  const group = (
    eventId: string,
    name: string,
    type: ActivityType,
    extra: Partial<FakeActivityGroup> = {},
  ) => {
    const g: FakeActivityGroup = {
      id: `f-gac-${groups.length + 1}`,
      eventId,
      name,
      type,
      batch: null,
      capacity: null,
      withMonitors: false,
      active: true,
      ...extra,
    };
    groups.push(g);
    return g;
  };
  const add = (
    g: FakeActivityGroup,
    personId: string | null,
    role: 'monitor' | 'participant' = 'participant',
    name = personId ? nameOf(personId) : '',
  ) => members.push({ groupId: g.id, role, personId, name });

  const kids = conv
    .filter((r) => r.role === 'participant' && !r.status)
    .map((r) => r.personId)
    .filter((id, i, all) => all.indexOf(id) === i);
  const patrols = ['Patrulla Halcones', 'Patrulla Linces', 'Patrulla 3'].map(
    (n) => group('f-ev-convivencia', n, 'patrol', { withMonitors: true }),
  );
  group('f-ev-convivencia', 'Patrulla 4', 'patrol', { withMonitors: true });
  // Tres sin patrulla (salen en «Sin patrulla»).
  kids.slice(0, kids.length - 3).forEach((id, i) => add(patrols[i % 3], id));
  add(patrols[0], monitorsD1[0], 'monitor');
  add(patrols[1], monitorsD1[1], 'monitor');
  // Un monitor que no se apuntó: sale con su nombre y no se marca.
  add(patrols[2], null, 'monitor', 'Rocío Fuentes Lara');
  // Una cancelada que seguía en su patrulla.
  add(patrols[2], notGoing[0]);

  const rooms = ['Habitación 12', '14', 'Hab. 15 (chicas)'].map((n) =>
    group('f-ev-convivencia', n, 'room', { capacity: 8 }),
  );
  kids.forEach((id, i) => add(rooms[i < 9 ? 0 : 1 + (i % 2)], id));

  // La salida pasada: dos mitades, una anulada con gente (se ve porque el
  // evento acabó) y otra anulada vacía (no se ve).
  const halves = ['Mitad A', 'Mitad B'].map((n) =>
    group('f-ev-inicio', n, 'subgroup', { batch: 'Mitades' }),
  );
  const cancelled = group('f-ev-inicio', 'Mitad C', 'subgroup', {
    batch: 'Mitades',
    active: false,
  });
  group('f-ev-inicio', 'Mitad D', 'subgroup', {
    batch: 'Mitades',
    active: false,
  });
  registrations['f-ev-inicio']
    .filter((r) => r.role === 'participant')
    .forEach((r, i) =>
      add(i % 5 === 4 ? cancelled : halves[i % 2], r.personId),
    );

  return {
    anchor: today,
    events,
    registrations,
    sessions,
    marks,
    groups,
    members,
    people,
  };
}

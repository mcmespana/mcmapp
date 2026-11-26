// services/comunica/fake/managedEvents.ts
//
// «Eventos que gestionas» en el servidor falso (plan 18): el check-in de
// Comunica Tools. Va aparte de `index.ts` y comparte con él el estado a través
// de `ctx`. Se porta como el servidor de verdad
// (`comunicaMiddleware:src/app/managed-events.ts`):
//
//   · LA BARRERA: el evento tiene que tener a quien pide como gestor
//     (`MANAGERS`). Si no, 403 `event_out_of_scope`, exista o no. La ficha y la
//     salud, solo de una persona inscrita en ESE evento (`person_out_of_scope`);
//     marcar, solo inscripciones de ESE evento (`registration_out_of_scope`).
//     No hace falta ningún papel de equipo.
//   · Check-in y notas en una «tabla» por evento (como `event_checkins` de
//     Comunica Tools): marcar la llegada no toca la nota ni la habitación y al
//     revés. `at` se acepta si es de las últimas 48 h (si no, la hora de
//     ahora). La nota se limpia como allí (espacios y 300 caracteres).
//   · `checkins?since=` devuelve lo cambiado desde `since` con 15 s de margen
//     (repite alguna fila: la app lo mezcla por `updatedAt`).
//   · Mando `othersCheckIn`: en cada sondeo, «Comunica Tools» marca a alguien
//     que faltaba (para ver llegar lo de otros).
//
// Datos inventados: un encuentro en marcha (ECE, con gente de tres
// delegaciones, monitores, equipo, canceladas, habitaciones en dos casas,
// llegadas, «no viene» y notas), uno próximo sin habitaciones y uno pasado.
// El estado vive POR datos (`WeakMap`): `reset()` del falso lo deja como al
// principio.

import {
  CheckinBody,
  CheckinResult,
  HealthNote,
  ManagedCheckins,
  ManagedEventDetail,
  ManagedEventsResponse,
  ManagedPerson,
  NoteBody,
  type CheckinState,
  type Consents,
  type Guardian,
  type HealthKind,
  type ManagedRegistration,
  type ManagedRoom,
  type RouteName,
} from '../contract';
import { ComunicaApiError, type ComunicaApi } from '../client';
import { cleanNote } from '@/utils/comunica/checkin';
import { addDays } from '@/utils/comunica/madrid';
import { schoolLevelFromText } from '@/utils/comunica/schoolLevels';
import { fold } from '@/utils/comunica/search';
import { seededRandom, type FakeData, type PersonaId } from './fixtures';

export interface ManagedCtx {
  data: () => FakeData;
  gate: (route: RouteName, write?: boolean) => Promise<void>;
  persona: () => PersonaId;
  today: () => string;
  now: () => Date;
  nowIso: () => string;
  controls: () => { othersCheckIn: boolean };
}

export type ManagedKeys =
  | 'getManagedEvents'
  | 'getManagedEvent'
  | 'getManagedCheckins'
  | 'checkinManaged'
  | 'noteManaged'
  | 'getManagedPerson'
  | 'getManagedHealth';
type ManagedApi = Pick<ComunicaApi, ManagedKeys>;

/** El encuentro de hoy (con habitaciones), uno próximo y uno pasado. */
export const MANAGED_NOW = 'f-ge-encuentro';
export const MANAGED_NEXT = 'f-ge-pascua';
export const MANAGED_PAST = 'f-ge-convivencia';
/** Existe, pero nadie de prueba lo gestiona: 403 igual que si no existiera. */
export const MANAGED_OTHER = 'f-ge-ajeno';

/**
 * Quién gestiona qué. Coordinación (que además es del equipo) y una persona
 * sin papel de equipo (miembro sin hijos): un gestor puede no ser monitor.
 */
export const MANAGERS: Partial<Record<PersonaId, string[]>> = {
  coordination: [MANAGED_NOW, MANAGED_NEXT, MANAGED_PAST],
  memberNoKids: [MANAGED_NOW],
};

const ECE = { id: 'f-del-ece', name: 'ECE' };
const DELEGATIONS = [
  { id: 'f-del-villaclara', name: 'Villaclara' },
  { id: 'f-del-puertoalto', name: 'Puerto Alto' },
  { id: 'f-del-monteluz', name: 'Monteluz' },
];
const FIRST = [
  'Alba',
  'Bruno',
  'Carla',
  'Dani',
  'Elsa',
  'Fran',
  'Gala',
  'Hugo',
  'Inés',
  'Jaime',
  'Lola',
  'Marcos',
  'Nora',
  'Óscar',
  'Paula',
  'Quique',
  'Rocío',
  'Sergio',
  'Tania',
  'Unai',
  'Vera',
  'Xavi',
  'Yaiza',
  'Zoe',
];
const LAST = [
  'Abril',
  'Benito',
  'Cano',
  'Duarte',
  'Escudero',
  'Ferrer',
  'Gallardo',
  'Herrero',
  'Ibáñez',
  'Jurado',
  'Lozano',
  'Montero',
  'Navas',
  'Ortega',
  'Peña',
  'Quintana',
  'Rubio',
  'Salinas',
  'Toledo',
  'Úbeda',
  'Valle',
];
const LEVELS = ['1º ESO', '2º ESO', '3º ESO', '4º ESO', '1º Bachillerato'];
const ADULTS = ['Marta', 'Javier', 'Carmen', 'Luis', 'Elena', 'Raúl'];

interface FakeManagedPerson {
  reg: ManagedRegistration;
  birthDate?: string;
  ownPhone?: string;
  emergency?: string;
  email?: string;
  guardians: Guardian[];
  consents: Consents;
  health: { kind: HealthKind; text: string }[];
}

interface FakeManagedEvent {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  people: FakeManagedPerson[];
  rooms: ManagedRoom[];
  checkins: Map<string, CheckinState>;
}

interface State {
  events: FakeManagedEvent[];
}

const states = new WeakMap<FakeData, State>();

const pad = (n: number) => String(n).padStart(2, '0');
const phoneOf = (r: () => number) => {
  const d = () => Math.floor(r() * 10);
  return `6${d()}${d()} ${d()}${d()} ${d()}${d()} ${d()}${d()}`;
};

function makePeople(
  eventKey: string,
  r: () => number,
  plan: {
    n: number;
    role: ManagedRegistration['role'];
    delegation: { id: string; name: string } | null;
  }[],
  cancelled: number,
): FakeManagedPerson[] {
  const pick = <T>(l: readonly T[]) => l[Math.floor(r() * l.length)];
  const used = new Set<string>();
  const out: FakeManagedPerson[] = [];
  let seq = 0;
  const one = (
    role: ManagedRegistration['role'],
    delegation: { id: string; name: string } | null,
    status?: ManagedRegistration['registrationStatus'],
  ) => {
    let first = pick(FIRST);
    let last = `${pick(LAST)} ${pick(LAST)}`;
    while (used.has(`${first} ${last}`)) {
      first = pick(FIRST);
      last = `${pick(LAST)} ${pick(LAST)}`;
    }
    used.add(`${first} ${last}`);
    seq += 1;
    const kid = role === 'participant';
    const levelText = kid ? pick(LEVELS) : null;
    const level = levelText ? schoolLevelFromText(levelText) : null;
    const age = kid
      ? 12 + Math.max(0, LEVELS.indexOf(levelText!)) + (r() < 0.3 ? 1 : 0)
      : 19 + Math.floor(r() * 20);
    const healthNote = kid && r() < 0.18;
    const noPhotos = kid && r() < 0.12;
    const notHomeAlone = kid && r() < 0.2;
    const pid = `f-ge-per-${eventKey}-${pad(seq)}`;
    const surname = last.split(' ')[0];
    const guardians: Guardian[] = kid
      ? Array.from({ length: r() < 0.6 ? 2 : 1 }, (_, i) => {
          // Mujer en los pares de `ADULTS`, hombre en los impares: «Madre» no le toca a un Javier.
          const name = pick(ADULTS.filter((_, k) => k % 2 === i % 2));
          return {
            id: `${pid}-fam-${i + 1}`,
            fullName: `${name} ${surname}`,
            firstName: name,
            relationship: i === 0 ? 'Madre' : 'Padre',
            ...(r() < 0.9 ? { phone: phoneOf(r) } : {}),
            ...(r() < 0.5
              ? { email: `${name.toLowerCase()}@ejemplo.org` }
              : {}),
          };
        })
      : [];
    const tri = (rate = 0.25): boolean | null =>
      r() < rate ? null : r() < 0.85;
    out.push({
      reg: {
        registrationId: `f-ge-ins-${eventKey}-${pad(seq)}`,
        personId: pid,
        firstName: first,
        lastName: last,
        ...(r() < 0.5
          ? {
              photoUrl: `https://fotos.ejemplo.org/v1/managed-events/${eventKey}/people/${pid}/photo?v=1`,
            }
          : {}),
        age,
        schoolLevel: level ?? null,
        role,
        delegation,
        badges: {
          healthNote,
          ...(kid && r() < 0.1 ? { healthOther: true } : {}),
          noPhotos,
          notHomeAlone,
        },
        ...(status ? { registrationStatus: status } : {}),
      },
      ...(kid
        ? {
            birthDate: `${2026 - age}-${pad(1 + Math.floor(r() * 12))}-${pad(1 + Math.floor(r() * 28))}`,
          }
        : {}),
      ...(r() < (kid ? 0.4 : 0.95) ? { ownPhone: phoneOf(r) } : {}),
      ...(kid && r() < 0.2 ? { emergency: phoneOf(r) } : {}),
      ...(!kid || r() < 0.3
        ? { email: `${fold(first)}.${seq}@ejemplo.org` }
        : {}),
      guardians,
      consents: {
        goHomeAlone: notHomeAlone ? false : kid ? tri() : null,
        photos: noPhotos ? false : kid ? tri() : null,
        whatsapp: kid ? tri() : null,
        healthData: kid ? tri() : null,
        outings: kid ? tri() : null,
        participation: kid ? tri() : null,
        dataProtection: r() < 0.2 ? null : true,
      },
      health: healthNote
        ? [
            pick([
              { kind: 'allergies' as const, text: 'Frutos secos.' },
              { kind: 'intolerances' as const, text: 'Lactosa.' },
              {
                kind: 'treatments' as const,
                text: 'Inhalador antes de correr.',
              },
            ]),
          ]
        : [],
    });
  };
  for (const p of plan) {
    for (let i = 0; i < p.n; i++) one(p.role, p.delegation);
  }
  for (let i = 0; i < cancelled; i++) {
    one('participant', DELEGATIONS[i % DELEGATIONS.length], 'cancelled');
  }
  return out;
}

function build(today: string, nowIso: string): State {
  const r = seededRandom(20261126);
  const stamp = (minutesAgo: number) =>
    new Date(Date.parse(nowIso) - minutesAgo * 60_000)
      .toISOString()
      .replace(/\.\d{3}Z$/, 'Z');

  // El encuentro de hoy.
  const nowPeople = makePeople(
    'enc',
    r,
    [
      { n: 12, role: 'participant', delegation: DELEGATIONS[0] },
      { n: 10, role: 'participant', delegation: DELEGATIONS[1] },
      { n: 8, role: 'participant', delegation: DELEGATIONS[2] },
      { n: 1, role: 'participant', delegation: null },
      { n: 4, role: 'monitor', delegation: DELEGATIONS[0] },
      { n: 3, role: 'monitor', delegation: DELEGATIONS[1] },
      { n: 3, role: 'monitor', delegation: DELEGATIONS[2] },
      { n: 3, role: 'team', delegation: ECE },
    ],
    3,
  );
  const rooms: ManagedRoom[] = [
    ...['101', '102', '103', '104', '105'].map((code) => ({
      id: `f-ge-hab-${code}`,
      code,
      capacity: 6,
      floor: '1',
      venue: 'Albergue Los Pinos',
    })),
    ...['201', '202', '203'].map((code) => ({
      id: `f-ge-hab-${code}`,
      code,
      capacity: 4,
      floor: '2',
      venue: 'Albergue Los Pinos',
    })),
    ...['A', 'B'].map((code) => ({
      id: `f-ge-hab-casa-${code}`,
      code,
      capacity: 3,
      floor: null,
      venue: 'Casa del Huerto',
    })),
  ];
  const checkins = new Map<string, CheckinState>();
  const active = nowPeople.filter((p) => !p.reg.registrationStatus);
  active.forEach((p, i) => {
    const id = p.reg.registrationId;
    const c: CheckinState = { registrationId: id, updatedAt: stamp(60 - i) };
    // Habitación a casi todos (los de las dos casas, los del equipo).
    if (i < rooms.length * 4 && i % 9 !== 8) {
      c.roomId = rooms[Math.floor(i / 4) % rooms.length].id;
    }
    if (i % 3 === 0) {
      c.arrivedAt = stamp(120 - i);
      c.arrivedBy = 'secretaria@ejemplo.org';
    } else if (i === 7 || i === 19) {
      c.absent = true;
    }
    if (i === 4) {
      c.note = 'Llega el sábado por la mañana con su madre.';
      c.noteBy = 'secretaria@ejemplo.org';
    }
    if (i === 10) {
      c.note = 'Trae la autorización firmada en papel.';
      c.noteBy = 'secretaria@ejemplo.org';
    }
    if (i === 15) {
      c.note = 'Se va el domingo a las 12:00.';
      c.noteBy = 'secretaria@ejemplo.org';
    }
    if (Object.keys(c).length > 2) checkins.set(id, c);
  });

  const nextPeople = makePeople(
    'pas',
    r,
    [
      { n: 9, role: 'participant', delegation: DELEGATIONS[0] },
      { n: 3, role: 'monitor', delegation: DELEGATIONS[0] },
    ],
    0,
  );
  const pastPeople = makePeople(
    'con',
    r,
    [
      { n: 6, role: 'participant', delegation: DELEGATIONS[1] },
      { n: 2, role: 'monitor', delegation: DELEGATIONS[1] },
    ],
    0,
  );
  const pastCheckins = new Map<string, CheckinState>(
    pastPeople.map((p, i) => [
      p.reg.registrationId,
      {
        registrationId: p.reg.registrationId,
        arrivedAt: stamp(10 * 24 * 60 + i),
        arrivedBy: 'secretaria@ejemplo.org',
        updatedAt: stamp(10 * 24 * 60 + i),
      },
    ]),
  );

  return {
    events: [
      {
        id: MANAGED_NOW,
        name: 'Encuentro nacional de monitores',
        startDate: addDays(today, -1),
        endDate: addDays(today, 1),
        people: nowPeople,
        rooms,
        checkins,
      },
      {
        id: MANAGED_NEXT,
        name: 'Pascua joven',
        startDate: addDays(today, 20),
        endDate: addDays(today, 23),
        people: nextPeople,
        rooms: [],
        checkins: new Map(),
      },
      {
        id: MANAGED_PAST,
        name: 'Convivencia de otoño',
        startDate: addDays(today, -10),
        endDate: addDays(today, -9),
        people: pastPeople,
        rooms: [],
        checkins: pastCheckins,
      },
      {
        id: MANAGED_OTHER,
        name: 'Campamento de verano',
        startDate: addDays(today, 40),
        endDate: addDays(today, 50),
        people: [],
        rooms: [],
        checkins: new Map(),
      },
    ],
  };
}

const forbidden = (reason: string) =>
  new ComunicaApiError('forbidden', 'No tienes acceso a esto', 403, reason);
const validation = (message: string) =>
  new ComunicaApiError('validation', message, 422, 'bad_body');

/** El estado del falso (para los tests). */
export function managedStateOf(data: FakeData): State | undefined {
  return states.get(data);
}

export function managedEventsRoutes(ctx: ManagedCtx): ManagedApi {
  const state = () => {
    const d = ctx.data();
    let s = states.get(d);
    if (!s) {
      s = build(ctx.today(), ctx.nowIso());
      states.set(d, s);
    }
    return s;
  };
  /** Un evento que gestiona quien pide, o 403 (exista o no). */
  const mine = (eventId: string) => {
    const ok = MANAGERS[ctx.persona()]?.includes(eventId);
    const e = ok ? state().events.find((x) => x.id === eventId) : undefined;
    if (!e) throw forbidden('event_out_of_scope');
    return e;
  };
  const active = (e: FakeManagedEvent) =>
    e.people.filter((p) => !p.reg.registrationStatus);
  const arrivedOf = (e: FakeManagedEvent) =>
    active(e).filter((p) => e.checkins.get(p.reg.registrationId)?.arrivedAt)
      .length;
  const summary = (e: FakeManagedEvent) => ({
    id: e.id,
    name: e.name,
    startDate: e.startDate,
    endDate: e.endDate,
    delegation: ECE,
    registered: active(e).length,
    arrived: arrivedOf(e),
  });
  const lastOf = (rows: CheckinState[], fallback: string) =>
    rows.reduce((m, c) => (c.updatedAt > m ? c.updatedAt : m), '') || fallback;
  const minuteAgo = () =>
    new Date(ctx.now().getTime() - 60_000)
      .toISOString()
      .replace(/\.\d{3}Z$/, 'Z');
  const whoMarks = () => `${ctx.data().personas[ctx.persona()].name} (app)`;

  return {
    async getManagedEvents() {
      await ctx.gate('managedEvents');
      const from = addDays(ctx.today(), -30);
      const ids = MANAGERS[ctx.persona()] ?? [];
      const events = state()
        .events.filter((e) => ids.includes(e.id) && e.endDate >= from)
        .map(summary)
        .sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
      return ManagedEventsResponse.parse({
        generatedAt: ctx.nowIso(),
        events,
      });
    },

    async getManagedEvent(eventId) {
      await ctx.gate('managedEvent');
      const e = mine(eventId);
      const rows = [...e.checkins.values()];
      return ManagedEventDetail.parse({
        generatedAt: ctx.nowIso(),
        event: summary(e),
        registrations: [
          ...active(e).map((p) => p.reg),
          ...e.people.filter((p) => p.reg.registrationStatus).map((p) => p.reg),
        ],
        checkins: rows,
        since: lastOf(rows, minuteAgo()),
        rooms: e.rooms,
      });
    },

    async getManagedCheckins(eventId, since) {
      await ctx.gate('managedCheckins');
      const e = mine(eventId);
      if (ctx.controls().othersCheckIn) {
        // Alguien en Comunica Tools marca al primero que faltaba.
        const next = active(e).find((p) => {
          const c = e.checkins.get(p.reg.registrationId);
          return !c?.arrivedAt && !c?.absent;
        });
        if (next) {
          const id = next.reg.registrationId;
          e.checkins.set(id, {
            ...e.checkins.get(id),
            registrationId: id,
            arrivedAt: ctx.nowIso(),
            arrivedBy: 'secretaria@ejemplo.org',
            updatedAt: ctx.nowIso(),
          });
        }
      }
      const ok = Number.isFinite(Date.parse(since));
      const from = ok ? Date.parse(since) - 15_000 : -Infinity;
      const rows = [...e.checkins.values()].filter(
        (c) => Date.parse(c.updatedAt) > from,
      );
      return ManagedCheckins.parse({
        generatedAt: ctx.nowIso(),
        checkins: rows,
        since: lastOf(rows, ok ? since : minuteAgo()),
      });
    },

    async checkinManaged(eventId, body) {
      const parsed = CheckinBody.safeParse(body);
      if (!parsed.success) throw validation('No se ha entendido qué marcar.');
      await ctx.gate('managedCheckin', true);
      const e = mine(eventId);
      const ids = [...new Set(parsed.data.registrationIds)];
      const known = new Set(e.people.map((p) => p.reg.registrationId));
      if (!ids.every((id) => known.has(id))) {
        throw forbidden('registration_out_of_scope');
      }
      const now = ctx.now().getTime();
      const when = parsed.data.at ? Date.parse(parsed.data.at) : NaN;
      const okAt =
        Number.isFinite(when) &&
        when <= now + 60_000 &&
        when >= now - 48 * 3600_000;
      const at = okAt
        ? new Date(when).toISOString().replace(/\.\d{3}Z$/, 'Z')
        : ctx.nowIso();
      const by = whoMarks();
      for (const id of ids) {
        const prev = e.checkins.get(id);
        const next: CheckinState = {
          registrationId: id,
          ...(prev?.note ? { note: prev.note } : {}),
          ...(prev?.noteBy ? { noteBy: prev.noteBy } : {}),
          ...(prev?.roomId ? { roomId: prev.roomId } : {}),
          ...(parsed.data.to === 'in' ? { arrivedAt: at, arrivedBy: by } : {}),
          ...(parsed.data.to === 'absent' ? { absent: true as const } : {}),
          updatedAt: ctx.nowIso(),
        };
        e.checkins.set(id, next);
      }
      return CheckinResult.parse({
        checkins: ids.map((id) => e.checkins.get(id)),
      });
    },

    async noteManaged(eventId, body) {
      const parsed = NoteBody.safeParse(body);
      if (!parsed.success) throw validation('La nota no es válida.');
      await ctx.gate('managedNote', true);
      const e = mine(eventId);
      const id = parsed.data.registrationId;
      if (!e.people.some((p) => p.reg.registrationId === id)) {
        throw forbidden('registration_out_of_scope');
      }
      const note = cleanNote(parsed.data.note);
      const prev = e.checkins.get(id);
      e.checkins.set(id, {
        registrationId: id,
        ...(prev?.arrivedAt ? { arrivedAt: prev.arrivedAt } : {}),
        ...(prev?.arrivedBy ? { arrivedBy: prev.arrivedBy } : {}),
        ...(prev?.absent ? { absent: true as const } : {}),
        ...(prev?.roomId ? { roomId: prev.roomId } : {}),
        ...(note ? { note, noteBy: whoMarks() } : {}),
        updatedAt: ctx.nowIso(),
      });
      return CheckinResult.parse({ checkins: [e.checkins.get(id)] });
    },

    async getManagedPerson(eventId, personId) {
      await ctx.gate('managedPerson');
      const e = mine(eventId);
      const p = e.people.find((x) => x.reg.personId === personId);
      if (!p) throw forbidden('person_out_of_scope');
      const { reg } = p;
      return ManagedPerson.parse({
        generatedAt: ctx.nowIso(),
        person: {
          id: reg.personId,
          firstName: reg.firstName,
          lastName: reg.lastName,
          fullName: `${reg.firstName} ${reg.lastName}`,
          ...(reg.photoUrl ? { photoUrl: reg.photoUrl } : {}),
          ...(reg.age !== undefined ? { age: reg.age } : {}),
          ...(p.birthDate ? { birthDate: p.birthDate } : {}),
        },
        registrationId: reg.registrationId,
        phones: {
          ...(p.ownPhone ? { own: p.ownPhone } : {}),
          ...(p.emergency ? { emergency: p.emergency } : {}),
        },
        ...(p.email ? { email: p.email } : {}),
        guardians: p.guardians,
        consents: p.consents,
        badges: reg.badges,
      });
    },

    async getManagedHealth(eventId, personId) {
      await ctx.gate('managedHealth');
      const e = mine(eventId);
      const p = e.people.find((x) => x.reg.personId === personId);
      if (!p) throw forbidden('person_out_of_scope');
      return HealthNote.parse({
        generatedAt: ctx.nowIso(),
        personId,
        items: p.health,
      });
    },
  };
}

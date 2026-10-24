// services/comunica/fake/fixtures.ts
//
// Datos INVENTADOS para el servidor falso del área nativa (plan 00 §4).
// Deterministas: misma semilla, mismos datos, siempre. Nada sale del CRM: los
// nombres son combinaciones de una lista corta de nombres y apellidos
// corrientes, las delegaciones no existen y los ids llevan el prefijo `f-`, que
// ningún id del CRM tiene (un test lo comprueba).
//
// Lo que hay, a propósito, para que cada pantalla tenga sus casos:
//   · Dos delegaciones: Villaclara (la de las personas de prueba) y Puerto Alto
//     (para comprobar que lo de otra delegación da `forbidden`).
//   · Seis grupos en Villaclara de dos etapas (MIC y COM), uno de ellos vacío;
//     LC sin grupos ni evento («una etapa sin evento»).
//   · ~60 chavales, ~8 monitores; uno de ellos con dos grupos.
//   · Un curso, 2026-2027, con sesiones los sábados de 16:30 a 18:00.
//   · Listas pasadas, «sin registro» y huecos; una racha de tres faltas (una
//     justificada) y una de dos; marcas de salud, de fotos y de «no se va solo».
//   · Una convivencia y una reunión de programación sin lista.

import type {
  Delegation,
  GroupSummary,
  Mark,
  PersonBadges,
  Segment,
  SessionSummary,
  SetMark,
  Stage,
} from '../contract';
import { addDays, madridInstant } from '@/utils/comunica/madrid';

export const FIXTURE_SEED = 20262027;

// ── Azar con semilla (mulberry32) ───────────────────────────────────────────

export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Tipos internos del falso (más ricos que el contrato) ────────────────────

export interface FakePerson {
  id: string;
  firstName: string;
  lastName: string;
  schoolLevel?: string;
  badges: PersonBadges;
  delegationId: string;
}

export interface FakeGroup extends Omit<GroupSummary, 'counts'> {
  delegationId: string;
  participantIds: string[];
  monitorIds: string[];
}

export interface FakeSession extends SessionSummary {
  delegationId: string;
  /** Etapa del evento semanal; `null` en reuniones y eventos. */
  stage: Stage | null;
  name?: string;
}

export interface FakeRoll {
  sessionId: string;
  groupId: string;
  status: 'taken' | 'skipped';
  takenAt: string;
  marks: Record<string, SetMark>;
  notes: Record<string, string>;
}

export interface FakeEvent {
  id: string;
  name: string;
  delegationId: string;
  startDay: string;
  endDay: string;
}

export interface FakeData {
  season: string;
  delegations: Delegation[];
  people: FakePerson[];
  groups: FakeGroup[];
  sessions: FakeSession[];
  rolls: FakeRoll[];
  events: FakeEvent[];
  /** Texto de salud por persona: solo lo sirve `/people/:id/health`. */
  health: Record<string, string>;
  /** Personas a las que el falso no sabe inscribir (mando «no se puede inscribir»). */
  unregistrable: string[];
  /** Personas de prueba con las que se «entra». */
  personas: Record<PersonaId, { personId: string; name: string }>;
}

export type PersonaId = 'monitor' | 'coordination' | 'accompaniment' | 'other';

// ── Nombres de mentira ──────────────────────────────────────────────────────

const FIRST = [
  'Lucía',
  'Hugo',
  'Martina',
  'Mateo',
  'Sofía',
  'Leo',
  'Julia',
  'Pablo',
  'Valeria',
  'Daniel',
  'Paula',
  'Álvaro',
  'Carla',
  'Marcos',
  'Noa',
  'Adrián',
  'Emma',
  'Diego',
  'Alba',
  'Mario',
  'Vega',
  'Iker',
  'Lara',
  'Bruno',
  'Aitana',
  'Nico',
  'Irene',
  'Gael',
  'Olivia',
  'Izan',
  'Claudia',
  'Unai',
];
const LAST = [
  'Arenas',
  'Bosque',
  'Campos',
  'Durán',
  'Escobar',
  'Fuentes',
  'Galán',
  'Herrero',
  'Iglesias',
  'Jara',
  'Lozano',
  'Marín',
  'Navas',
  'Olmo',
  'Pastor',
  'Quintana',
  'Robles',
  'Salinas',
  'Toledo',
  'Urrutia',
  'Valle',
  'Zamora',
];

// ── Calendario del curso ────────────────────────────────────────────────────

export const SEASON = '2026-2027';
const FIRST_SATURDAY = '2026-09-19';
const LAST_SATURDAY = '2027-06-12';
/** Sábados sin sesión (puentes y vacaciones). */
const NO_SESSION = new Set([
  '2026-10-31',
  '2026-12-05',
  '2026-12-26',
  '2027-01-02',
  '2027-03-27',
  '2027-04-03',
]);
export const WEEKLY_START = '16:30';
export const WEEKLY_END = '18:00';

/** Día de referencia de los datos: lo que es «pasado» al generar. */
export const FIXTURE_TODAY = '2026-10-23';

const D1 = 'f-del-villaclara';
const D2 = 'f-del-puertoalto';

interface GroupSeed {
  code: string;
  name: string;
  stage: Stage;
  segment?: Segment;
  schoolLevels: string[];
  size: number;
  delegationId: string;
}

const GROUP_SEEDS: GroupSeed[] = [
  {
    code: 'M1',
    name: 'Los Peques',
    stage: 'mic',
    schoolLevels: ['3º Primaria'],
    size: 10,
    delegationId: D1,
  },
  {
    code: 'M2',
    name: 'Exploradores',
    stage: 'mic',
    schoolLevels: ['5º Primaria', '6º Primaria'],
    size: 12,
    delegationId: D1,
  },
  {
    code: 'C1',
    name: 'Brújula',
    stage: 'com',
    segment: 'com_1',
    schoolLevels: ['1º ESO'],
    size: 11,
    delegationId: D1,
  },
  {
    code: 'C2',
    name: 'Faro',
    stage: 'com',
    segment: 'com_1',
    schoolLevels: ['2º ESO'],
    size: 12,
    delegationId: D1,
  },
  {
    code: 'C3',
    name: 'Senderos',
    stage: 'com',
    segment: 'com_2',
    schoolLevels: ['3º ESO', '4º ESO'],
    size: 13,
    delegationId: D1,
  },
  {
    code: 'C5',
    name: 'Raíces',
    stage: 'com',
    segment: 'com_3',
    schoolLevels: ['1º Bachillerato'],
    size: 0,
    delegationId: D1,
  },
  {
    code: 'P1',
    name: 'Mareas',
    stage: 'com',
    segment: 'com_1',
    schoolLevels: ['1º ESO'],
    size: 8,
    delegationId: D2,
  },
];

const pad2 = (n: number) => String(n).padStart(2, '0');

export function generateFakeData(seed = FIXTURE_SEED): FakeData {
  const rand = seededRandom(seed);
  const pick = <T>(list: readonly T[]) =>
    list[Math.floor(rand() * list.length)];
  const people: FakePerson[] = [];
  const health: Record<string, string> = {};
  const usedNames = new Set<string>();

  const newPerson = (
    delegationId: string,
    schoolLevel?: string,
  ): FakePerson => {
    let firstName = pick(FIRST);
    let lastName = `${pick(LAST)} ${pick(LAST)}`;
    while (usedNames.has(`${firstName} ${lastName}`)) {
      firstName = pick(FIRST);
      lastName = `${pick(LAST)} ${pick(LAST)}`;
    }
    usedNames.add(`${firstName} ${lastName}`);
    const person: FakePerson = {
      id: `f-per-${pad2(people.length + 1)}`,
      firstName,
      lastName,
      schoolLevel,
      badges: { healthNote: false, noPhotos: false, notHomeAlone: false },
      delegationId,
    };
    people.push(person);
    return person;
  };

  // Grupos y chavales.
  const groups: FakeGroup[] = GROUP_SEEDS.map((g, gi) => {
    const participantIds: string[] = [];
    for (let i = 0; i < g.size; i++) {
      const p = newPerson(
        g.delegationId,
        g.schoolLevels[i % g.schoolLevels.length],
      );
      const r = rand();
      if (r < 0.12) {
        p.badges.healthNote = true;
        health[p.id] = pick([
          'Alergia a los frutos secos. Lleva su medicación en la mochila.',
          'Asma leve: inhalador si hace mucho esfuerzo.',
          'Intolerancia a la lactosa.',
        ]);
      }
      if (rand() < 0.1) p.badges.noPhotos = true;
      if (rand() < 0.15) p.badges.notHomeAlone = true;
      participantIds.push(p.id);
    }
    return {
      id: `f-grp-${pad2(gi + 1)}`,
      code: g.code,
      name: g.name,
      stage: g.stage,
      segment: g.segment,
      schoolLevels: g.schoolLevels,
      delegationId: g.delegationId,
      participantIds,
      monitorIds: [],
    };
  });

  // Monitores: dos por grupo con chavales, salvo C1 y C2, que comparten uno
  // («un monitor con dos grupos») — es la persona de prueba «monitor».
  const monitorFor = (g: FakeGroup) => {
    const m = newPerson(g.delegationId);
    g.monitorIds.push(m.id);
    return m;
  };
  const byCode = (code: string) => groups.find((g) => g.code === code)!;
  const shared = monitorFor(byCode('C1'));
  byCode('C2').monitorIds.push(shared.id);
  for (const code of ['M1', 'M2', 'C2', 'C3', 'P1']) monitorFor(byCode(code));
  monitorFor(byCode('M1'));
  const coordinator = newPerson(D1);
  const companion = newPerson(D1);

  // Sesiones semanales: un evento por etapa con grupos (MIC y COM).
  const sessions: FakeSession[] = [];
  for (const delegationId of [D1, D2]) {
    const stages: Stage[] = delegationId === D1 ? ['mic', 'com'] : ['com'];
    for (const stage of stages) {
      let day = FIRST_SATURDAY;
      let n = 0;
      while (day <= LAST_SATURDAY) {
        if (!NO_SESSION.has(day)) {
          n += 1;
          sessions.push({
            id: `f-ses-${delegationId === D1 ? 'v' : 'p'}${stage}-${pad2(n)}`,
            eventId: `f-evt-${delegationId === D1 ? 'v' : 'p'}${stage}`,
            date: day,
            startsAt: madridInstant(day, WEEKLY_START),
            endsAt: madridInstant(day, WEEKLY_END),
            kind: 'weekly',
            delegationId,
            stage,
          });
        }
        day = addDays(day, 7);
      }
    }
  }
  // Una reunión de programación sin lista (coordinación).
  sessions.push({
    id: 'f-ses-reunion-01',
    eventId: 'f-evt-reuniones',
    date: '2026-10-20',
    startsAt: madridInstant('2026-10-20', '20:00'),
    endsAt: madridInstant('2026-10-20', '21:30'),
    kind: 'meeting',
    delegationId: D1,
    stage: null,
    name: 'Reunión de programación',
  });

  // Listas de lo ya celebrado.
  const rolls: FakeRoll[] = [];
  const past = sessions.filter(
    (s) => s.kind === 'weekly' && s.date < FIXTURE_TODAY,
  );
  for (const g of groups) {
    if (g.participantIds.length === 0) continue;
    const mine = past.filter(
      (s) => s.stage === g.stage && s.delegationId === g.delegationId,
    );
    mine.forEach((s, si) => {
      const isLast = si === mine.length - 1;
      // Huecos: C1 no tiene la última (el atajo de la persona «monitor» la
      // propone) y M2 tiene un hueco más atrás.
      if (g.code === 'C1' && isLast) return;
      if (g.code === 'M2' && si === 1) return;
      if (g.code === 'C3' && si === 2) {
        rolls.push({
          sessionId: s.id,
          groupId: g.id,
          status: 'skipped',
          takenAt: madridInstant(s.date, '18:10'),
          marks: {},
          notes: {},
        });
        return;
      }
      const marks: Record<string, SetMark> = {};
      for (const pid of g.participantIds) {
        const r = rand();
        marks[pid] =
          r < 0.78
            ? 'yes'
            : r < 0.84
              ? 'partial'
              : r < 0.92
                ? 'no_justified'
                : 'no_unjustified';
      }
      rolls.push({
        sessionId: s.id,
        groupId: g.id,
        status: 'taken',
        takenAt: madridInstant(s.date, '18:05'),
        marks,
        notes: {},
      });
    });
  }

  // Rachas: en C2, el primero falta las tres últimas (una justificada) y el
  // segundo las dos últimas.
  const c2 = byCode('C2');
  const c2Rolls = rolls
    .filter((r) => r.groupId === c2.id && r.status === 'taken')
    .sort((a, b) => (a.sessionId < b.sessionId ? 1 : -1));
  const [streak3, streak2] = c2.participantIds;
  const streakMarks: SetMark[] = [
    'no_unjustified',
    'no_justified',
    'no_unjustified',
  ];
  c2Rolls.slice(0, 3).forEach((r, i) => {
    r.marks[streak3] = streakMarks[i];
    if (i < 2) r.marks[streak2] = 'no_unjustified';
  });
  // Una nota en una lista pasada.
  if (c2Rolls[0])
    c2Rolls[0].notes[c2.participantIds[3]] =
      'Se fue a las 17:15, le recogió su abuela.';

  const events: FakeEvent[] = [
    {
      id: 'f-evt-convivencia',
      name: 'Convivencia de otoño',
      delegationId: D1,
      startDay: '2026-10-24',
      endDay: '2026-10-25',
    },
    {
      id: 'f-evt-pascua',
      name: 'Pascua joven',
      delegationId: D1,
      startDay: '2027-03-25',
      endDay: '2027-03-28',
    },
  ];

  // Uno de C1 que el falso «no sabe inscribir».
  const unregistrable = [byCode('C1').participantIds[0]];

  const otherMonitor = byCode('P1').monitorIds[0];
  const name = (id: string) => {
    const p = people.find((x) => x.id === id)!;
    return `${p.firstName} ${p.lastName}`;
  };

  return {
    season: SEASON,
    delegations: [
      { id: D1, name: 'Villaclara' },
      { id: D2, name: 'Puerto Alto' },
    ],
    people,
    groups,
    sessions,
    rolls,
    events,
    health,
    unregistrable,
    personas: {
      monitor: { personId: shared.id, name: name(shared.id) },
      coordination: { personId: coordinator.id, name: name(coordinator.id) },
      accompaniment: { personId: companion.id, name: name(companion.id) },
      other: { personId: otherMonitor, name: name(otherMonitor) },
    },
  };
}

/** Las marcas de una persona en una lista, o `null` si no está marcada. */
export function markOf(roll: FakeRoll | undefined, personId: string): Mark {
  return roll?.marks[personId] ?? null;
}

// ── Acceso (plan 02) ────────────────────────────────────────────────────────
// Correos y DNI inventados. `ejemplo.org` no es de nadie de verdad.

/** El código que vale en el servidor falso, para cualquier correo o DNI. */
export const FAKE_CODE = '123456';

/** Con qué correo entra cada persona de prueba. `dos@` es de dos fichas. */
export const FAKE_EMAILS: Record<string, PersonaId[]> = {
  'monitor@ejemplo.org': ['monitor'],
  'coordinacion@ejemplo.org': ['coordination'],
  'acompanamiento@ejemplo.org': ['accompaniment'],
  'otra@ejemplo.org': ['other'],
  'dos@ejemplo.org': ['monitor', 'coordination'],
};

export const FAKE_DNIS: Record<string, PersonaId> = {
  '12345678Z': 'monitor',
};

/** Este correo siempre da `rate_limited`. */
export const FAKE_RATE_LIMITED_EMAIL = 'limite@ejemplo.org';

/** Tokens del enlace del correo (`acceso_app`): uno vale, otro ha caducado. */
export const FAKE_LINK_TOKENS: Record<string, PersonaId | null> = {
  'enlace-valido': 'monitor',
  'enlace-caducado': null,
};

/** Enlaces del plugin que el falso canjea: `acceso_magico` y token permanente. */
export const FAKE_PLUGIN_LINKS: Record<string, PersonaId> = {
  'magico-valido': 'monitor',
  'token-valido': 'monitor',
  'magico-coordinacion': 'coordination',
};

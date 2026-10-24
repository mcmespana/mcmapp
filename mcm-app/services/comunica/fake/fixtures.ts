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
//   · Grupos y fichas (plan 05): familia (1-2 por chaval; una sin teléfonos,
//     un chaval sin familia, uno con teléfono de emergencias, dos del COM con
//     móvil propio, con y sin permiso de WhatsApp), autorizaciones (~30 % sin
//     contestar), salud en 1 de cada 5 (una con «datos de salud» a «No»),
//     foto en la mitad (imágenes abstractas), ~15 % sin grupo, avisos (2 y 3),
//     eventos del curso y pañuelos. Todo con una SEGUNDA semilla, para no
//     mover ni un dato de los de arriba.

import type {
  Consents,
  Delegation,
  GroupSummary,
  HealthKind,
  Mark,
  Notice,
  PersonBadges,
  PersonEvent,
  Scarf,
  Segment,
  SessionSummary,
  SetMark,
  Stage,
} from '../contract';
import { addDays, madridInstant } from '@/utils/comunica/madrid';
import { schoolLevelFromText } from '@/utils/comunica/schoolLevels';

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

export interface FakeGuardian {
  id: string;
  firstName: string;
  lastName: string;
  relationship: string;
  phone?: string;
  email?: string;
}

/** Lo que un participante tiene en su ficha (y un monitor no). */
export interface FakeProfile {
  age?: number;
  birthDate?: string;
  /** Versión de la foto; sin ella, no tiene. */
  photo?: string;
  ownPhone?: string;
  emergency?: string;
  /** Ya en orden de alta: el primero es el tutor 1. */
  guardians: FakeGuardian[];
  consents: Consents;
  scarf: Scarf;
  document?: { kindLabel: string; number: string };
  street?: string;
  postcode?: string;
  city?: string;
  school?: string;
  email?: string;
  size?: string;
  stageLabel?: string;
  comLevelLabel?: string;
  personNumber?: string;
}

/** Una relación de participante SIN grupo de la delegación. */
export interface FakeMembership {
  id: string;
  personId: string;
  delegationId: string;
}

export type FakeHealthItem = { kind: HealthKind; text: string };

export interface FakePersonEvent {
  eventId: string;
  status: PersonEvent['status'];
  reason?: string;
}

export interface FakeData {
  season: string;
  delegations: Delegation[];
  people: FakePerson[];
  groups: FakeGroup[];
  sessions: FakeSession[];
  rolls: FakeRoll[];
  events: FakeEvent[];
  /** Salud por persona: solo la sirve `/people/:id/health`. */
  health: Record<string, FakeHealthItem[]>;
  /** Fichas de los participantes (plan 05). */
  profiles: Record<string, FakeProfile>;
  /** Relaciones de participante sin grupo («sueltos»). */
  memberships: FakeMembership[];
  /** Avisos de comportamiento por persona. */
  notices: Record<string, Notice[]>;
  /** Eventos del curso por persona. */
  personEvents: Record<string, FakePersonEvent[]>;
  /** Grupos del CRM sin marcar para Pasar Lista, por delegación. */
  hiddenGroups: Record<string, number>;
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
  const health: Record<string, FakeHealthItem[]> = {};
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
        health[p.id] = pick<FakeHealthItem[]>([
          [
            {
              kind: 'allergies',
              text: 'Frutos secos. Lleva su medicación en la mochila.',
            },
          ],
          [
            { kind: 'illnesses', text: 'Asma leve.' },
            { kind: 'treatments', text: 'Inhalador si hace mucho esfuerzo.' },
          ],
          [{ kind: 'intolerances', text: 'Lactosa.' }],
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
      id: 'f-evt-salida',
      name: 'Salida a la sierra',
      delegationId: D1,
      startDay: '2026-10-10',
      endDay: '2026-10-11',
    },
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

  const extra = generateProfiles({
    people,
    groups,
    health,
    monitorIds: new Set([
      ...groups.flatMap((g) => g.monitorIds),
      coordinator.id,
      companion.id,
    ]),
    seed,
  });

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
    ...extra,
    hiddenGroups: { [D1]: 2 },
    unregistrable,
    personas: {
      monitor: { personId: shared.id, name: name(shared.id) },
      coordination: { personId: coordinator.id, name: name(coordinator.id) },
      accompaniment: { personId: companion.id, name: name(companion.id) },
      other: { personId: otherMonitor, name: name(otherMonitor) },
    },
  };
}

// ── Grupos y fichas (plan 05) ───────────────────────────────────────────────

const ADULT_FIRST = [
  'Marta',
  'Javier',
  'Carmen',
  'Luis',
  'Elena',
  'Raúl',
  'Pilar',
  'Andrés',
  'Rosa',
  'Sergio',
  'Nuria',
  'Óscar',
  'Teresa',
  'Ramón',
];
const STREETS = [
  'Calle Mayor',
  'Avenida del Río',
  'Calle de los Almendros',
  'Plaza Nueva',
  'Calle Olivo',
];
const SCHOOLS = [
  'Colegio Valle Verde',
  'IES Puerta del Sol Naciente',
  'Colegio Santa Clara de Villaclara',
];
const SIZES = ['8', '10', '12', '14', 'S', 'M', 'L'];

/** Edad «típica» de cada curso (la que tendrán este otoño). */
const AGE_BY_LEVEL: Record<string, number> = {
  ep3: 8,
  ep4: 9,
  ep5: 10,
  ep6: 11,
  eso1: 12,
  eso2: 13,
  eso3: 14,
  eso4: 15,
  bach1: 16,
  bach2: 17,
};

/** Sueltos de Villaclara: cursos variados, uno raro, uno «Otros» y uno sin curso. */
const LOOSE_LEVELS: (string | undefined)[] = [
  '3º Primaria',
  '5º Primaria',
  '1º ESO',
  '1º ESO',
  '2º ESO',
  '3º ESO',
  '1º Bachillerato',
  'Otros',
  'Curso puente',
  undefined,
];

const ascii = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const phoneOf = (r: () => number) => {
  const d = () => Math.floor(r() * 10);
  return `6${d()}${d()} ${d()}${d()} ${d()}${d()} ${d()}${d()}`;
};

interface ProfileInput {
  people: FakePerson[];
  groups: FakeGroup[];
  health: Record<string, FakeHealthItem[]>;
  monitorIds: Set<string>;
  seed: number;
}

/**
 * Lo del plan 05, con su propia semilla: añade sueltos al final de `people` (no
 * cambia ningún id anterior) y no toca las marcas de las listas.
 */
function generateProfiles({
  people,
  groups,
  health,
  monitorIds,
  seed,
}: ProfileInput): Pick<
  FakeData,
  'profiles' | 'memberships' | 'notices' | 'personEvents'
> {
  const r = seededRandom(seed + 5);
  const pick = <T>(list: readonly T[]) => list[Math.floor(r() * list.length)];
  const used = new Set(people.map((p) => `${p.firstName} ${p.lastName}`));

  // Los sueltos: relación de participante sin grupo. Nueve en Villaclara y uno
  // en Puerto Alto (para el 403).
  const memberships: FakeMembership[] = [];
  const loose = (delegationId: string, schoolLevel?: string) => {
    let firstName = pick(FIRST);
    let lastName = `${pick(LAST)} ${pick(LAST)}`;
    while (used.has(`${firstName} ${lastName}`)) {
      firstName = pick(FIRST);
      lastName = `${pick(LAST)} ${pick(LAST)}`;
    }
    used.add(`${firstName} ${lastName}`);
    const p: FakePerson = {
      id: `f-per-${pad2(people.length + 1)}`,
      firstName,
      lastName,
      schoolLevel,
      badges: { healthNote: false, noPhotos: false, notHomeAlone: false },
      delegationId,
    };
    people.push(p);
    memberships.push({
      id: `f-rel-${pad2(memberships.length + 1)}`,
      personId: p.id,
      delegationId,
    });
  };
  LOOSE_LEVELS.forEach((lvl) => loose(D1, lvl));
  loose(D2, '1º ESO');

  const participantIds = [
    ...groups.flatMap((g) => g.participantIds),
    ...memberships.map((m) => m.personId),
  ];
  const groupOf = (pid: string) =>
    groups.find((g) => g.participantIds.includes(pid));

  // Salud en 1 de cada 5: a la de partida se le suma alguna más.
  for (const pid of participantIds) {
    if (!health[pid] && r() < 0.1) {
      health[pid] = pick<FakeHealthItem[]>([
        [{ kind: 'allergies', text: 'Picadura de abeja.' }],
        [
          { kind: 'allergies', text: 'Penicilina.' },
          { kind: 'other', text: 'Gafas para ver de lejos.' },
        ],
        [{ kind: 'intolerances', text: 'Gluten (celíaca).' }],
      ]);
    }
  }

  const profiles: Record<string, FakeProfile> = {};
  const c3 = groups.find((g) => g.code === 'C3');
  // Los casos con nombre, para que cada pantalla tenga el suyo.
  const ownWithWhatsapp = c3?.participantIds[0];
  const ownWithoutWhatsapp = c3?.participantIds[1];
  const healthNo = participantIds.find((pid) => health[pid]);
  const noFamily = groups.find((g) => g.code === 'M1')?.participantIds[1];
  const familyNoPhones = groups.find((g) => g.code === 'M1')?.participantIds[2];
  const withEmergency = groups.find((g) => g.code === 'C1')?.participantIds[1];

  let guardianSeq = 0;
  let personNumber = 1000;
  for (const pid of participantIds) {
    const p = people.find((x) => x.id === pid)!;
    if (monitorIds.has(pid)) continue;
    const level = p.schoolLevel ? schoolLevelFromText(p.schoolLevel) : null;
    const baseAge = level?.key ? AGE_BY_LEVEL[level.key] : undefined;
    const age =
      baseAge !== undefined ? baseAge + (r() < 0.3 ? 1 : 0) : undefined;
    const birthDate =
      age !== undefined
        ? `${2026 - age}-${pad2(1 + Math.floor(r() * 9))}-${pad2(1 + Math.floor(r() * 28))}`
        : undefined;
    const tri = (rate = 0.3): boolean | null =>
      r() < rate ? null : r() < 0.85;
    const consents: Consents = {
      goHomeAlone: p.badges.notHomeAlone ? false : r() < 0.3 ? null : true,
      photos: p.badges.noPhotos ? false : r() < 0.3 ? null : true,
      whatsapp: tri(),
      healthData: pid === healthNo ? false : r() < 0.3 ? null : true,
      outings: tri(),
      participation: tri(),
      dataProtection: r() < 0.3 ? null : true,
    };

    const surname = p.lastName.split(' ')[0];
    const guardians: FakeGuardian[] = [];
    if (pid !== noFamily) {
      const n = r() < 0.6 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        guardianSeq += 1;
        const firstName = pick(ADULT_FIRST);
        const lastName =
          i === 0 ? `${surname} ${pick(LAST)}` : `${pick(LAST)} ${pick(LAST)}`;
        const relationship =
          n === 1
            ? pick(['Madre', 'Padre', 'Tutora legal', 'Abuela'])
            : i === 0
              ? 'Madre'
              : 'Padre';
        const hasPhone = pid !== familyNoPhones && r() < 0.92;
        guardians.push({
          id: `f-fam-${pad2(guardianSeq)}`,
          firstName,
          lastName,
          relationship: r() < 0.05 ? '' : relationship,
          phone: hasPhone
            ? r() < 0.04
              ? '+44 7700 900123'
              : phoneOf(r)
            : undefined,
          email:
            r() < 0.75
              ? `${ascii(firstName)}.${ascii(lastName.split(' ')[0])}@ejemplo.org`
              : undefined,
        });
      }
    }

    if (pid === ownWithWhatsapp) consents.whatsapp = true;
    if (pid === ownWithoutWhatsapp) consents.whatsapp = null;
    const ownPhone =
      pid === ownWithWhatsapp || pid === ownWithoutWhatsapp
        ? phoneOf(r)
        : undefined;

    const g = groupOf(pid);
    const stageLabel =
      g?.stage === 'mic' ? 'MIC' : g?.stage === 'com' ? 'COM' : undefined;
    profiles[pid] = {
      age,
      birthDate,
      photo: r() < 0.5 ? `v${Math.floor(r() * 1e6).toString(36)}` : undefined,
      ownPhone,
      emergency: pid === withEmergency ? '964 00 11 22' : undefined,
      guardians,
      consents,
      scarf: pick<Scarf>([
        'none',
        'red',
        'green',
        'blue',
        'yellow',
        'cross',
        'unknown',
        'green',
        'red',
      ]),
      document:
        r() < 0.7
          ? {
              kindLabel: 'DNI',
              number: `${Math.floor(r() * 9e7 + 1e7)}${pick(['A', 'K', 'Z', 'T'])}`,
            }
          : undefined,
      street:
        r() < 0.8 ? `${pick(STREETS)} ${1 + Math.floor(r() * 40)}` : undefined,
      postcode: '12001',
      city: p.delegationId === D1 ? 'Villaclara' : 'Puerto Alto',
      school: r() < 0.7 ? pick(SCHOOLS) : undefined,
      email:
        age !== undefined && age >= 14 && r() < 0.6
          ? `${ascii(p.firstName)}${Math.floor(r() * 90 + 10)}@ejemplo.org`
          : undefined,
      size: r() < 0.6 ? pick(SIZES) : undefined,
      stageLabel,
      comLevelLabel:
        g?.stage === 'com' && r() < 0.5 ? pick(['COM 1', 'COM 2']) : undefined,
      personNumber: String((personNumber += 1)),
    };
    // Las marcas las decide el servidor con el «0» explícito: la de salud,
    // solo si hay texto y la familia no dijo «no» al uso de los datos.
    p.badges.healthNote = !!health[pid] && consents.healthData !== false;
  }

  // Avisos: uno de C1 con dos, uno de C2 con tres (el límite) y uno de M2 con uno.
  const notices: Record<string, Notice[]> = {};
  const nameOfMonitor = (g: FakeGroup | undefined) =>
    g ? people.find((x) => x.id === g.monitorIds[0])?.firstName : undefined;
  const addNotices = (
    code: string,
    index: number,
    list: Omit<Notice, 'id' | 'placedBy'>[],
  ) => {
    const g = groups.find((x) => x.code === code);
    const pid = g?.participantIds[index];
    if (!pid) return;
    notices[pid] = list.map((n, i) => ({
      ...n,
      id: `f-avi-${code}-${i + 1}`,
      placedBy: nameOfMonitor(g),
    }));
  };
  addNotices('C1', 2, [
    {
      date: '2026-10-03',
      reason: 'Se fue del local sin avisar durante el juego.',
      familyNotified: true,
    },
    {
      date: '2026-10-17',
      reason: 'Insultó a un compañero en la oración.',
      familyNotified: false,
    },
  ]);
  addNotices('C2', 4, [
    {
      date: '2026-09-26',
      reason: 'Rompió a propósito el material del taller.',
      familyNotified: true,
    },
    {
      date: '2026-10-03',
      reason: 'No dejó hablar a nadie en la revisión.',
      familyNotified: true,
    },
    {
      date: '2026-10-17',
      reason: 'Empujó a otro en la escalera.',
      familyNotified: false,
    },
  ]);
  addNotices('M2', 3, [
    {
      date: '2026-10-10',
      reason: 'Se escondió y no volvió al grupo hasta el final.',
      familyNotified: true,
    },
  ]);

  // Eventos del curso: la salida (ya pasó), la convivencia (hoy) y Pascua.
  const personEvents: Record<string, FakePersonEvent[]> = {};
  for (const pid of participantIds) {
    const p = people.find((x) => x.id === pid)!;
    if (p.delegationId !== D1) continue;
    const list: FakePersonEvent[] = [];
    const a = r();
    if (a < 0.6) list.push({ eventId: 'f-evt-salida', status: 'yes' });
    else if (a < 0.7)
      list.push({
        eventId: 'f-evt-salida',
        status: 'no_justified',
        reason: 'Cumpleaños de su prima',
      });
    else if (a < 0.8) list.push({ eventId: 'f-evt-salida', status: 'no_roll' });
    else if (a < 0.85)
      list.push({ eventId: 'f-evt-salida', status: 'cancelled' });
    const b = r();
    if (b < 0.6)
      list.push({ eventId: 'f-evt-convivencia', status: 'registered' });
    if (r() < 0.3) list.push({ eventId: 'f-evt-pascua', status: 'registered' });
    if (list.length) personEvents[pid] = list;
  }

  return { profiles, memberships, notices, personEvents };
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

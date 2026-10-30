// services/comunica/fake/fixturesCoordination.ts
//
// Los datos INVENTADOS de Coordinación (plan 06) para el servidor falso, con
// su propia semilla y AÑADIDOS al final de los de `fixtures.ts`: no mueven
// ningún id anterior ni ninguna marca de los chavales (los planes 04 y 05 los
// usan). Va aparte para que `fixtures.ts` no crezca sin fin.
//
//   · Listas de monitores de los sábados: una racha de 3 faltas al final (una
//     justificada), uno por debajo del 60 % y uno con solo 3 marcas.
//   · Tres reuniones: pasada con faltas y motivos (y una sin motivo), la de
//     octubre sin lista (ya existía) y una futura.
//   · Un monitor en MIC y COM, dos sin grupo (comodín y grupo fuera de Pasar
//     Lista), quien coordina y acompaña (monitor de M1, sin inscribir) y
//     coordinación de COM · COM 2.
//   · Un grupo sin código ni segmento y un recuento de hace 5 días.
//   · Fichas de monitor con su papeleo y seguimientos de los tres tipos (del
//     curso anterior, sin fecha, de un tipo desconocido y sobre una persona
//     de coordinación).

import type { SetMark } from '../contract';
import type {
  FakeData,
  FakeFollowUp,
  FakeGroup,
  FakeMonitorMembership,
  FakeMonitorProfile,
  FakeMonitorRoll,
  FakePerson,
  FakeRoll,
  FakeSession,
} from './fixtures';
import { madridInstant } from '@/utils/comunica/madrid';

const pad2 = (n: number) => String(n).padStart(2, '0');
const ascii = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const COORD_FIRST = [
  'Andrea',
  'Jorge',
  'Inés',
  'Rubén',
  'Celia',
  'Tomás',
  'Laura',
  'Víctor',
];

interface CoordinationInput {
  people: FakePerson[];
  groups: FakeGroup[];
  sessions: FakeSession[];
  rolls: FakeRoll[];
  used: Set<string>;
  coordinatorName: string;
  companionName: string;
  /** La tercera semilla (la de este plan). */
  rand: () => number;
  /** Villaclara, la delegación de las personas de prueba. */
  delegationId: string;
  lastNames: readonly string[];
  streets: readonly string[];
  fixtureToday: string;
  season: string;
}

/**
 * Lo del plan 06, con su propia semilla: añade al final (personas, un grupo
 * sin código, reuniones) sin mover ningún id anterior ni ninguna marca de los
 * chavales. Los monitores nuevos se suman a grupos que ya existían.
 */
export function generateCoordination({
  people,
  groups,
  sessions,
  rolls,
  used,
  coordinatorName,
  companionName,
  rand: r,
  delegationId: D1,
  lastNames: LAST,
  streets: STREETS,
  fixtureToday: FIXTURE_TODAY,
  season: SEASON,
}: CoordinationInput): {
  personaIds: { coordinationCom2: string; both: string };
  data: Pick<
    FakeData,
    | 'monitorRolls'
    | 'monitorRegistrations'
    | 'registrationsCreated'
    | 'monitorMemberships'
    | 'monitorProfiles'
    | 'followUps'
    | 'headcountAgeDays'
    | 'rollTakers'
    | 'eventNames'
  >;
} {
  const pick = <T>(list: readonly T[]) => list[Math.floor(r() * list.length)];
  const adult = (): FakePerson => {
    let firstName = pick(COORD_FIRST);
    let lastName = `${pick(LAST)} ${pick(LAST)}`;
    while (used.has(`${firstName} ${lastName}`)) {
      firstName = pick(COORD_FIRST);
      lastName = `${pick(LAST)} ${pick(LAST)}`;
    }
    used.add(`${firstName} ${lastName}`);
    const p: FakePerson = {
      id: `f-per-${pad2(people.length + 1)}`,
      firstName,
      lastName,
      badges: { healthNote: false, noPhotos: false, notHomeAlone: false },
      delegationId: D1,
    };
    people.push(p);
    return p;
  };
  const byCode = (code: string) => groups.find((g) => g.code === code)!;
  const nameOf = (id: string) => {
    const p = people.find((x) => x.id === id)!;
    return `${p.firstName} ${p.lastName}`;
  };

  // Los monitores de Villaclara de antes, para nombrar los casos.
  const [m1a, m1b] = byCode('M1').monitorIds;
  const [m2] = byCode('M2').monitorIds;
  const [shared, c2] = byCode('C2').monitorIds;
  const [c3] = byCode('C3').monitorIds;
  const before = [shared, m1a, m2, c2, c3, m1b];

  // Gente nueva: uno en MIC y COM (llegó tarde: 3 marcas), quien coordina y
  // acompaña (monitor de M1, sin inscribir al evento), coordinación de COM 2
  // y dos monitores sin grupo.
  const dual = adult();
  byCode('M2').monitorIds.push(dual.id);
  byCode('C3').monitorIds.push(dual.id);
  const both = adult();
  byCode('M1').monitorIds.push(both.id);
  const com2 = adult();
  const looseA = adult();
  const looseB = adult();
  const monitorMemberships: FakeMonitorMembership[] = [
    { id: 'f-relm-01', personId: looseA.id, delegationId: D1, kind: 'none' },
    {
      id: 'f-relm-02',
      personId: looseB.id,
      delegationId: D1,
      kind: 'outside',
      outsideGroupName: 'Coro de jóvenes',
    },
  ];

  // Un grupo de COM sin código ni segmento (para «Datos por revisar»).
  groups.push({
    id: `f-grp-${pad2(groups.length + 1)}`,
    code: null,
    name: 'Grupo nuevo de 4.º de ESO',
    stage: 'com',
    schoolLevels: ['4º ESO'],
    delegationId: D1,
    participantIds: [],
    monitorIds: [],
  });

  // Reuniones de programación: una pasada con faltas y motivos (la de
  // octubre, sin lista, ya existía) y una futura.
  const meeting = (
    id: string,
    day: string,
    start: string,
    end: string,
    name: string,
  ) =>
    sessions.push({
      id,
      eventId: 'f-evt-reuniones',
      date: day,
      startsAt: madridInstant(day, start),
      endsAt: madridInstant(day, end),
      kind: 'meeting',
      delegationId: D1,
      stage: null,
      name,
    });
  meeting(
    'f-ses-reunion-00',
    '2026-09-29',
    '19:00',
    '21:00',
    'Programación del 1.er trimestre',
  );
  meeting(
    'f-ses-reunion-02',
    '2026-11-17',
    '19:00',
    '20:30',
    'Revisión de noviembre',
  );

  // Listas de monitores de los sábados ya celebrados, por etapa.
  const monitorRolls: FakeMonitorRoll[] = [];
  const registrations: Record<string, string[]> = {
    'f-evt-vmic': [],
    'f-evt-vcom': [],
    'f-evt-reuniones': [],
  };
  const register = (eventId: string, pid: string) => {
    if (!registrations[eventId].includes(pid)) registrations[eventId].push(pid);
  };
  const plan: Record<string, SetMark[]> = {
    // Tres seguidas sin venir al final (una justificada).
    [c2]: ['yes', 'yes', 'no_unjustified', 'no_justified', 'no_unjustified'],
    // Por debajo del 60 % (2 de 5) y sin racha de tres.
    [m2]: ['yes', 'no_unjustified', 'no_justified', 'yes', 'no_unjustified'],
  };
  const reasons: Record<string, Record<number, string>> = {
    [c2]: { 3: 'Exámenes en la universidad' },
    [m2]: { 2: 'Viaje familiar' },
  };
  for (const stage of ['mic', 'com'] as const) {
    const past = sessions
      .filter(
        (x) =>
          x.delegationId === D1 &&
          x.kind === 'weekly' &&
          x.stage === stage &&
          x.date < FIXTURE_TODAY,
      )
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    const team = [
      ...new Set(
        groups
          .filter((g) => g.delegationId === D1 && g.stage === stage)
          .flatMap((g) => g.monitorIds),
      ),
    ].filter((pid) => pid !== both.id && (stage === 'mic' || pid !== dual.id));
    past.forEach((x, i) => {
      const marks: Record<string, SetMark> = {};
      const notes: Record<string, string> = {};
      for (const pid of team) {
        // El de dos etapas llegó a mitad: solo las tres últimas.
        if (pid === dual.id && i < past.length - 3) continue;
        const planned = plan[pid]?.[i];
        marks[pid] = planned ?? (r() < 0.9 ? 'yes' : 'partial');
        const why = reasons[pid]?.[i];
        if (why) notes[pid] = why;
        else if (marks[pid] === 'partial') notes[pid] = 'Llegó a las 17:00';
        register(`f-evt-v${stage}`, pid);
      }
      monitorRolls.push({
        sessionId: x.id,
        status: 'taken',
        takenAt: madridInstant(x.date, '18:20'),
        marks,
        notes,
      });
    });
  }
  // La reunión de septiembre, con sus faltas y sus motivos (o sin él).
  const meetingMarks: Record<string, SetMark> = {};
  for (const pid of before) meetingMarks[pid] = 'yes';
  meetingMarks[m2] = 'no_justified';
  meetingMarks[c3] = 'no_unjustified';
  meetingMarks[m1b] = 'partial';
  monitorRolls.push({
    sessionId: 'f-ses-reunion-00',
    status: 'taken',
    takenAt: madridInstant('2026-09-29', '21:05'),
    marks: meetingMarks,
    notes: {
      [m2]: 'Trabajo de fin de grado',
      [m1b]: 'Llegó a las 20:15',
    },
  });
  before.forEach((pid) => register('f-evt-reuniones', pid));

  // Quién pasó cada lista de grupo: se turnan los monitores del grupo.
  const rollTakers: Record<string, string> = {};
  for (const roll of rolls) {
    if (roll.status !== 'taken') continue;
    const g = groups.find((x) => x.id === roll.groupId);
    if (!g || g.monitorIds.length === 0) continue;
    const n = Number(roll.sessionId.slice(-2));
    // En C2, las tres últimas las pasa el monitor compartido (el otro faltó).
    rollTakers[`${roll.sessionId}:${roll.groupId}`] =
      g.code === 'C2' && n >= 3
        ? shared
        : g.monitorIds[n % g.monitorIds.length];
  }

  // Recuentos: todos de esta noche, salvo C2 (hace 5 días) y el sin código.
  const headcountAgeDays: Record<string, number | null> = {};
  for (const g of groups) headcountAgeDays[g.id] = g.code === null ? null : 0;
  headcountAgeDays[byCode('C2').id] = 5;

  // Fichas de los monitores de Villaclara.
  const monitorProfiles: Record<string, FakeMonitorProfile> = {};
  const allMonitors = [...before, dual.id, both.id, looseA.id, looseB.id];
  const phone = () => {
    const d = () => Math.floor(r() * 10);
    return `6${d()}${d()} ${d()}${d()} ${d()}${d()} ${d()}${d()}`;
  };
  const COMPLIANCE_REQUIRED = [
    'Certificado de delitos sexuales',
    'Formación en protección del menor',
    'Código de conducta',
  ];
  const buildProfile = (pid: string, i: number) => {
    const p = people.find((x) => x.id === pid)!;
    const age = 18 + Math.floor(r() * 12);
    const sinceYear = Math.min(2026, 2026 - Math.floor(r() * (age - 16)));
    const myGroups = groups.filter((g) => g.monitorIds.includes(pid));
    const groupsSince: Record<string, string> = {};
    for (const g of myGroups) groupsSince[g.id] = `${2026 - (i % 3)}-09-15`;
    const mail = `${ascii(p.firstName)}.${ascii(p.lastName.split(' ')[0])}@ejemplo.org`;
    const stageLabel = myGroups[0]?.stage === 'mic' ? 'MIC' : 'COM';
    monitorProfiles[pid] = {
      age,
      sinceYear,
      photo: r() < 0.5 ? `m${Math.floor(r() * 1e6).toString(36)}` : undefined,
      mobile: pid === looseB.id ? undefined : phone(),
      otherPhone: i % 3 === 0 ? '964 55 66 77' : undefined,
      email: pid === m1b ? undefined : mail,
      doNotCall: pid === m1a,
      groupsSince,
      missing:
        pid === c3
          ? [...COMPLIANCE_REQUIRED]
          : pid === m2
            ? ['Protección de datos (LOPD)']
            : pid === dual.id
              ? ['Compromiso firmado']
              : [],
      mcm: [
        ...(stageLabel === 'COM'
          ? [{ label: 'Nivel COM', value: 'II · Incorporación' }]
          : []),
        { label: 'Etapa', value: stageLabel },
        { label: 'Pañuelo', value: pick(['Verde', 'Rojo', 'Azul']) },
        { label: 'Monitor/a de', value: stageLabel },
        { label: 'Monitor/a desde', value: String(sinceYear) },
        { label: 'En el MCM desde', value: String(sinceYear - 6) },
      ],
      training: [
        ...(age >= 20
          ? [
              {
                label: 'MAT · Monitor/a de tiempo libre',
                value: 'Titulado',
                ok: true,
                note: 'MAT Godelleta 2024',
                ...(i % 4 === 1 ? { warn: 'sin archivo' } : {}),
              },
            ]
          : []),
        { label: 'Premonitores I', value: 'Finalizado', ok: true },
        ...(i % 2 === 0
          ? [{ label: 'Premonitores II', value: 'En curso', ok: false }]
          : []),
      ],
      congresses: i % 2 === 0 ? ['2025 Benicàssim'] : [],
      academic: age >= 21 ? 'Grado en Magisterio' : undefined,
      personal: [
        {
          label: 'DNI',
          value: `${Math.floor(r() * 9e7 + 1e7)}${pick(['A', 'K', 'Z', 'T'])}`,
        },
        {
          label: 'Fecha de nacimiento',
          value: `${2026 - age}-0${1 + (i % 9)}-1${i % 9}`,
        },
        {
          label: 'Dirección',
          value: `${pick(STREETS)} ${1 + i} · 12001 Villaclara`,
        },
        { label: 'Nº de persona', value: String(2000 + i) },
      ],
      history:
        sinceYear < 2026 && myGroups[0]
          ? [
              {
                season: '2025-2026',
                groups: [
                  {
                    code: myGroups[0].code,
                    name: myGroups[0].name,
                    schoolLevels: myGroups[0].schoolLevels,
                    colleagues: [nameOf(before[(i + 1) % before.length])],
                  },
                ],
              },
              ...(sinceYear < 2025
                ? [
                    {
                      season: '2024-2025',
                      groups: [
                        {
                          code: 'M3',
                          name: 'Los Valientes',
                          schoolLevels: ['4º Primaria'],
                          colleagues: [
                            nameOf(before[(i + 2) % before.length]),
                            nameOf(before[(i + 3) % before.length]),
                          ],
                        },
                      ],
                    },
                  ]
                : []),
            ]
          : [],
    };
  };
  allMonitors.forEach(buildProfile);

  // Seguimientos: de los tres tipos sobre el de la racha (con uno del curso
  // anterior, uno sin fecha y uno de un tipo que no se conoce) y una
  // incidencia sobre quien coordina y acompaña.
  const coordFirst = coordinatorName.split(' ')[0];
  const compFirst = companionName.split(' ')[0];
  const followUps: Record<string, FakeFollowUp[]> = {
    [c2]: [
      {
        id: 'f-seg-01',
        type: 'incident',
        date: '2026-10-17',
        text: 'No avisó de que no venía y su grupo se quedó con un solo monitor.',
        author: coordFirst,
      },
      {
        id: 'f-seg-02',
        type: 'assessment',
        date: '2026-10-05',
        text: 'Primer mes con mucha energía. Le cuesta preparar las sesiones con tiempo.',
        author: coordFirst,
      },
      {
        id: 'f-seg-03',
        type: 'accompaniment',
        date: '2026-10-12',
        text: 'Está con exámenes y algo agobiado. Hablamos de cómo repartir el tiempo.',
        author: compFirst,
      },
      {
        id: 'f-seg-04',
        type: 'incident',
        date: '2026-03-14',
        text: 'Se fue antes de acabar la oración sin decir nada.',
        author: coordFirst,
      },
      {
        id: 'f-seg-05',
        type: 'otro',
        date: '2026-10-08',
        text: 'Un tipo escrito a mano en el CRM: no se enseña.',
        author: coordFirst,
      },
      {
        id: 'f-seg-06',
        type: 'incident',
        date: null,
        text: 'Nota sin fecha: pidió cambiar de grupo.',
        author: coordFirst,
      },
    ],
    [both.id]: [
      {
        id: 'f-seg-07',
        type: 'incident',
        date: '2026-10-10',
        text: 'Llegó tarde a la salida a la sierra.',
        author: coordFirst,
      },
    ],
  };

  // Apoyo (lo ven todas las coordinaciones) y otro grupo que no pasa lista,
  // al final para no mover el azar de lo de antes (plugin, 24-25/10/2026).
  const apoyoA = adult();
  const apoyoB = adult();
  const najar = adult();
  monitorMemberships.push(
    {
      id: 'f-relm-03',
      personId: apoyoA.id,
      delegationId: D1,
      kind: 'support',
      outsideGroupName: 'Monitores Apoyo',
    },
    {
      id: 'f-relm-04',
      personId: apoyoB.id,
      delegationId: D1,
      kind: 'support',
      outsideGroupName: 'Monitores Apoyo',
    },
    {
      id: 'f-relm-05',
      personId: najar.id,
      delegationId: D1,
      kind: 'outside',
      outsideGroupName: 'Najar',
    },
  );
  [apoyoA.id, apoyoB.id, najar.id].forEach((pid, k) =>
    buildProfile(pid, allMonitors.length + k),
  );

  return {
    personaIds: { coordinationCom2: com2.id, both: both.id },
    data: {
      monitorRolls,
      monitorRegistrations: registrations,
      registrationsCreated: 0,
      monitorMemberships,
      monitorProfiles,
      followUps,
      headcountAgeDays,
      rollTakers,
      eventNames: {
        'f-evt-vmic': `Sesiones MIC ${SEASON}`,
        'f-evt-vcom': `Sesiones COM ${SEASON}`,
        'f-evt-reuniones': `Monitores | Reuniones de programación ${SEASON}`,
      },
    },
  };
}

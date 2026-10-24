// services/comunica/contract.ts
//
// El contrato entre la app y el servidor del área privada nativa
// (`mcm-comunica-api`, aún por crear). Es lo ÚNICO que la app sabe del
// servidor: detrás puede leer el CRM por SQL, por la API o desde un espejo, y
// la app no se entera. Plan: `docs/planes/area-nativa/00-contrato-y-servidor-falso.md`.
//
// Reglas (las largas, en el plan 00 §2):
//   · Los tipos salen de los esquemas (`z.infer`): no se escribe un tipo a mano.
//   · El vocabulario es el del glosario del plan 00 §1. Un concepto se llama
//     igual aquí, en el código y en la pantalla.
//   · Nada de nombres del CRM (`ajmcm_…`, `stic_…`): los traduce el servidor.
//   · La salud NUNCA viaja en una lectura que se guarda en el móvil: solo
//     `hasHealthNote`/`badges.healthNote`. El texto, solo en `HealthNote`
//     (`GET /v1/people/:id/health`). Lo vigila un test.
//   · Las respuestas de lectura llevan `generatedAt` (el «actualizado hace»).
//
// Este fichero tiene lo compartido (plan 00 §3), el trozo de Pasar Lista
// (plan 04 «Datos»), el de Grupos y fichas (plan 05) y el de Coordinación
// (plan 06). Cada plan de
// pantallas añade aquí su trozo al ejecutarse.

// El esquema y su tipo se llaman igual (`Me` el valor, `Me` el tipo): es el
// patrón de zod, y lo que la regla toma por redeclaración es justo eso.
/* eslint-disable @typescript-eslint/no-redeclare */

import { z } from 'zod';

// ── Primitivas ──────────────────────────────────────────────────────────────

/** Instante con zona: `2026-10-25T10:00:00+02:00`. Nunca «UTC sin zona». */
export const Instant = z.iso.datetime({ offset: true });
/** Día en hora de Madrid: `2026-10-25`. */
export const Day = z.iso.date();
/** Id del CRM como cadena opaca: la app no lo interpreta. */
export const Id = z.string().min(1);
/** UUID que genera el móvil para que reintentar una escritura no duplique. */
export const ClientId = z.uuid();
/**
 * La foto de una persona: solo https (se pide con el token de acceso; por
 * http viajaría en claro). Revisión A, hallazgo 7.
 */
export const PhotoUrl = z.url({ protocol: /^https$/ });

// ── Errores ─────────────────────────────────────────────────────────────────

export const ERROR_CODES = [
  'unauthenticated', // 401
  'forbidden', // 403 — también lo que no existe fuera de tu alcance
  'not_found',
  'validation',
  'crm_unavailable', // 503 — el CRM no contesta; la escritura sigue en la cola
  'conflict',
  'rate_limited',
] as const;
export const ErrorCode = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ErrorBody = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    /** Detalle de máquina: p. ej. `nothing_marked` en un `validation`. */
    reason: z.string().optional(),
    /** Con `rate_limited`: segundos que hay que esperar. */
    retryAfter: z.number().int().nonnegative().optional(),
  }),
});
export type ErrorBody = z.infer<typeof ErrorBody>;

// ── Tipos compartidos (plan 00 §3) ──────────────────────────────────────────

export const Delegation = z.object({ id: Id, name: z.string() });
export type Delegation = z.infer<typeof Delegation>;

export const ROLES = [
  'monitor',
  'coordination',
  'accompaniment',
  'member',
  'guardian',
] as const;
export const Role = z.enum(ROLES);
export type Role = z.infer<typeof Role>;

/** Papeles «de equipo»: los que ven Pasar Lista. */
export const TEAM_ROLES: readonly Role[] = [
  'monitor',
  'coordination',
  'accompaniment',
];

export const STAGES = ['mic', 'com', 'lc', 'apoyo'] as const;
export const Stage = z.enum(STAGES);
export type Stage = z.infer<typeof Stage>;

export const SEGMENTS = ['com_1', 'com_2', 'com_3'] as const;
export const Segment = z.enum(SEGMENTS);
export type Segment = z.infer<typeof Segment>;

export const Me = z.object({
  personId: Id,
  name: z.string(),
  photoUrl: PhotoUrl.optional(),
  delegation: Delegation,
  roles: z.array(Role),
  /** `'delegation'` = toda la delegación; si no, las etapas/segmentos que ve. */
  scope: z.union([
    z.literal('delegation'),
    z.object({
      stages: z.array(Stage).optional(),
      segments: z.array(Segment).optional(),
    }),
  ]),
  canSeeHealth: z.boolean(),
});
export type Me = z.infer<typeof Me>;

export const PersonBadges = z.object({
  /** Tiene una nota de salud. Solo la marca: el texto nunca viaja aquí. */
  healthNote: z.boolean(),
  /** La familia no autoriza fotos. */
  noPhotos: z.boolean(),
  /** No puede irse solo a casa. */
  notHomeAlone: z.boolean(),
});
export type PersonBadges = z.infer<typeof PersonBadges>;

export const PersonSummary = z.object({
  id: Id,
  firstName: z.string(),
  lastName: z.string(),
  photoUrl: PhotoUrl.optional(),
  schoolLevel: z.string().optional(),
  badges: PersonBadges,
});
export type PersonSummary = z.infer<typeof PersonSummary>;

export const GroupSummary = z.object({
  id: Id,
  /** «C1», «M4.2»: identifica el grupo en todas las pantallas (plan 04). */
  code: z.string().nullable(),
  name: z.string(),
  stage: Stage.nullable(),
  segment: Segment.optional(),
  schoolLevels: z.array(z.string()),
  counts: z.object({
    /**
     * `null` = no se sabe (el mapa de relaciones vino a medias y no hay
     * recuento fresco): la app no pinta número. Nunca un cero inventado
     * (`MIS-GRUPOS.md` §8 del plugin, plan 05).
     */
    participants: z.number().int().nonnegative().nullable(),
    monitors: z.number().int().nonnegative(),
  }),
});
export type GroupSummary = z.infer<typeof GroupSummary>;

export const SESSION_KINDS = ['weekly', 'meeting', 'event'] as const;
export const SessionSummary = z.object({
  id: Id,
  eventId: Id,
  date: Day,
  startsAt: Instant,
  endsAt: Instant,
  kind: z.enum(SESSION_KINDS),
});
export type SessionSummary = z.infer<typeof SessionSummary>;

/** `null` = sin marcar: un quinto estado, NO una falta. */
export const MARKS = [
  'yes',
  'partial',
  'no_justified',
  'no_unjustified',
] as const;
export const SetMark = z.enum(MARKS);
export type SetMark = z.infer<typeof SetMark>;
export const Mark = SetMark.nullable();
export type Mark = z.infer<typeof Mark>;

export const RollCallSummary = z.object({
  sessionId: Id,
  groupId: Id.optional(),
  /** `taken` «Pasada» · `skipped` «Sin registro». Sin lista = «Pendiente». */
  status: z.enum(['taken', 'skipped']),
  takenAt: Instant,
  counts: z.object({
    came: z.number().int().nonnegative(),
    missed: z.number().int().nonnegative(),
  }),
});
export type RollCallSummary = z.infer<typeof RollCallSummary>;

export const WriteResult = z.object({
  clientId: ClientId,
  status: z.enum(['applied', 'queued']),
  crmIds: z.array(Id).optional(),
});
export type WriteResult = z.infer<typeof WriteResult>;

/** Toda lectura lleva la hora del servidor. */
const read = <T extends z.ZodRawShape>(shape: T) =>
  z.object({ generatedAt: Instant, ...shape });

// ── Acceso (plan 02) ────────────────────────────────────────────────────────

export const MeResponse = read({ me: Me });
export type MeResponse = z.infer<typeof MeResponse>;

/** `POST /v1/auth/code` — misma respuesta exista o no el correo. */
export const CodeRequest = z.union([
  z.object({ email: z.email() }),
  z.object({ dni: z.string().min(5).max(12) }),
]);
export type CodeRequest = z.infer<typeof CodeRequest>;
export const CodeResponse = z.object({
  /** El correo tapado: «m•••@gmail.com». */
  sentTo: z.string(),
});
export type CodeResponse = z.infer<typeof CodeResponse>;

/** `POST /v1/auth/verify` */
export const VerifyRequest = z.union([
  z.object({
    email: z.email(),
    code: z.string().regex(/^\d{6}$/),
    personId: Id.optional(),
  }),
  z.object({
    dni: z.string(),
    code: z.string().regex(/^\d{6}$/),
    personId: Id.optional(),
  }),
  z.object({ linkToken: z.string().min(1), personId: Id.optional() }),
]);
export type VerifyRequest = z.infer<typeof VerifyRequest>;

export const Tokens = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  /** Segundos que vale el de acceso (~15 min). */
  expiresIn: z.number().int().positive(),
});
export type Tokens = z.infer<typeof Tokens>;

export const PersonChoice = z.object({
  personId: Id,
  name: z.string(),
  delegation: z.string(),
});
export type PersonChoice = z.infer<typeof PersonChoice>;

/** O entra, o hay que elegir ficha (un correo de varias fichas del CRM). */
export const VerifyResponse = z.union([
  Tokens.extend({ me: Me }),
  z.object({ choose: z.array(PersonChoice).min(2) }),
]);
export type VerifyResponse = z.infer<typeof VerifyResponse>;

/** `POST /v1/auth/refresh` — el de refresco ROTA en cada uso. */
export const RefreshRequest = z.object({ refreshToken: z.string().min(1) });
export const RefreshResponse = Tokens;
export type RefreshResponse = z.infer<typeof RefreshResponse>;

/** `POST /v1/auth/exchange` — un enlace del plugin por una sesión nativa (plan 10). */
export const ExchangeRequest = z.union([
  z.object({ magic: z.string().min(1) }),
  z.object({ token: z.string().min(1) }),
]);
export type ExchangeRequest = z.infer<typeof ExchangeRequest>;

/** `POST /v1/web-pass` — abrir una página del plugin con la sesión puesta. */
export const WebPassRequest = z.object({
  internalpage: z.string().regex(/^[a-z0-9_]{1,64}$/),
  action: z.enum(['detail', 'create', 'edit']).optional(),
  id: z
    .string()
    .regex(/^[a-f0-9-]{10,64}$/i)
    .optional(),
  from: z
    .string()
    .regex(/^[a-z_]{1,32}$/)
    .optional(),
  profileId: Id.optional(),
});
export type WebPassRequest = z.infer<typeof WebPassRequest>;
export const WebPass = z.object({
  /** URL completa del plugin con un `acceso_magico` de 2 minutos. */
  url: z.url(),
  expiresAt: Instant,
});
export type WebPass = z.infer<typeof WebPass>;

/** Motivos de `validation` en el acceso. */
export const AUTH_REJECTIONS = [
  'bad_code',
  'code_expired',
  'link_expired',
  'blocked',
] as const;

// ── Pasar Lista (plan 04 «Datos») ───────────────────────────────────────────

export const GroupWithMonitors = GroupSummary.extend({
  monitorNames: z.array(z.string()),
});
export type GroupWithMonitors = z.infer<typeof GroupWithMonitors>;

/** `GET /v1/groups` — la estructura (cambia poco: 12 h en el móvil). */
export const GroupsResponse = read({
  season: z.string(),
  groups: z.array(GroupWithMonitors),
  myGroupIds: z.array(Id),
  stageEvents: z.array(
    z.object({
      stage: Stage,
      eventId: Id,
      sessions: z.array(SessionSummary),
    }),
  ),
  hiddenGroups: z.number().int().nonnegative(),
  participantsWithoutGroup: z.number().int().nonnegative(),
});
export type GroupsResponse = z.infer<typeof GroupsResponse>;

/** `GET /v1/today` — el estado (cambia mucho: 5 min en el móvil). */
export const TodayResponse = read({
  rollCalls: z.array(RollCallSummary),
  eventsToday: z.array(
    z.object({
      id: Id,
      name: z.string(),
      startsAt: Instant,
      endsAt: Instant,
      todayIs: z.enum(['single', 'start', 'end']),
    }),
  ),
  eventsThisSeason: z.number().int().nonnegative(),
  pendingMeeting: z
    .object({ sessionId: Id, date: Day, name: z.string() })
    .nullable(),
});
export type TodayResponse = z.infer<typeof TodayResponse>;

export const RollEntry = z.object({
  person: PersonSummary,
  mark: Mark,
  note: z.string(),
  /** Hasta 3, de sesiones celebradas ANTES de esta, la última primero. */
  previousMarks: z.array(Mark).max(3),
});
export type RollEntry = z.infer<typeof RollEntry>;

/** `GET /v1/sessions/:sid/groups/:gid/roll` */
export const RollDetail = read({
  session: SessionSummary,
  groupId: Id,
  roll: RollCallSummary.nullable(),
  monitors: z.array(
    z.object({ id: Id, firstName: z.string(), lastName: z.string() }),
  ),
  entries: z.array(RollEntry),
});
export type RollDetail = z.infer<typeof RollDetail>;

export const NOTE_MAX = 255;

/**
 * `PUT /v1/sessions/:sid/groups/:gid/roll`. En `marks`, `null` = quitar la
 * marca guardada de esa persona: el servidor borra su asistencia (borrado
 * lógico) o la deja vacía (`desmarcar`, 21/10). Quien no tenía marca no va.
 */
export const RollWrite = z.object({
  clientId: ClientId,
  action: z.enum(['save', 'skip']),
  marks: z.record(Id, Mark),
  notes: z.record(Id, z.string().max(NOTE_MAX)),
});
export type RollWrite = z.infer<typeof RollWrite>;

export const ROLL_REJECTIONS = [
  'nothing_marked',
  'session_in_future',
  'already_taken',
] as const;

export const RollWriteResult = WriteResult.extend({
  roll: RollDetail,
  rollCall: RollCallSummary,
  notSaved: z.array(
    z.object({
      personId: Id,
      reason: z.enum(['not_in_group', 'no_registration', 'crm_error']),
    }),
  ),
});
export type RollWriteResult = z.infer<typeof RollWriteResult>;

// ── Grupos y fichas (plan 05 «Datos») ───────────────────────────────────────

/** Los cursos que el área reconoce, en orden escolar. */
export const SCHOOL_LEVEL_KEYS = [
  'ep3',
  'ep4',
  'ep5',
  'ep6',
  'eso1',
  'eso2',
  'eso3',
  'eso4',
  'bach1',
  'bach2',
  'fp_gm',
  'fp_gs',
  'university',
  'other',
] as const;
export const SchoolLevelKey = z.enum(SCHOOL_LEVEL_KEYS);
export type SchoolLevelKey = z.infer<typeof SchoolLevelKey>;

/**
 * El curso de una persona: el de su relación y, si no lo tiene, el de su
 * grupo. `label` es la corta («4 EP», «1 ESO», «1 Bach»), la que cabe en un
 * chip. `key: null` = un texto que el servidor no reconoce (va sin color).
 * Sin curso, el campo no viene.
 */
export const SchoolLevel = z.object({
  key: SchoolLevelKey.nullable(),
  label: z.string(),
});
export type SchoolLevel = z.infer<typeof SchoolLevel>;

/** Un participante en las listas de Grupos y fichas. */
export const ParticipantRow = PersonSummary.omit({ schoolLevel: true }).extend({
  schoolLevel: SchoolLevel.optional(),
  age: z.number().int().nonnegative().optional(),
  /** `null` = sin grupo de la delegación. */
  groupId: Id.nullable(),
  /** Sin grupo: la relación a la que se le puede poner grupo. */
  unassignedMembershipId: Id.optional(),
});
export type ParticipantRow = z.infer<typeof ParticipantRow>;

/** `GET /v1/people` — todos los participantes vigentes, con grupo o sin él. */
export const PeopleIndex = read({
  season: z.string(),
  /** El curso anterior se ha cerrado y el nuevo no está abierto. */
  seasonClosed: z.boolean(),
  people: z.array(ParticipantRow),
});
export type PeopleIndex = z.infer<typeof PeopleIndex>;

/** Un monitor dentro de un grupo: sin marcas (son de los chavales). */
export const MonitorRow = z.object({
  id: Id,
  firstName: z.string(),
  lastName: z.string(),
  photoUrl: PhotoUrl.optional(),
});
export type MonitorRow = z.infer<typeof MonitorRow>;

/** `GET /v1/groups/:id` */
export const GroupDetail = read({
  group: GroupSummary,
  monitors: z.array(MonitorRow),
  participants: z.array(ParticipantRow),
});
export type GroupDetail = z.infer<typeof GroupDetail>;

export const Guardian = z.object({
  id: Id,
  fullName: z.string(),
  firstName: z.string().optional(),
  /** «Madre», «Padre», «Tutora legal»… o `''` si el CRM no lo dice. */
  relationship: z.string(),
  /** En bruto, como está en el CRM: la app lo limpia para llamar. */
  phone: z.string().optional(),
  email: z.string().optional(),
});
export type Guardian = z.infer<typeof Guardian>;

/** Las autorizaciones de un menor. `null` = sin contestar (NO es un «no»). */
export const Consents = z.object({
  goHomeAlone: z.boolean().nullable(),
  photos: z.boolean().nullable(),
  whatsapp: z.boolean().nullable(),
  healthData: z.boolean().nullable(),
  outings: z.boolean().nullable(),
  participation: z.boolean().nullable(),
  dataProtection: z.boolean().nullable(),
});
export type Consents = z.infer<typeof Consents>;

export const SCARVES = [
  'none',
  'red',
  'green',
  'blue',
  'yellow',
  'cross',
  'unknown',
] as const;
export const Scarf = z.enum(SCARVES);
export type Scarf = z.infer<typeof Scarf>;
/** Lo que se puede escribir: «Desconocido» solo se lee. */
export const SetScarf = Scarf.exclude(['unknown']);
export type SetScarf = z.infer<typeof SetScarf>;

/** Un evento del curso de la persona (convivencias, salidas…). */
export const PersonEvent = z.object({
  eventId: Id,
  name: z.string(),
  startsAt: Instant,
  endsAt: Instant,
  /** Su marca; `no_roll` = sin lista; `registered` = apuntado y aún no ha sido; `cancelled` = no va. */
  status: z.union([SetMark, z.enum(['no_roll', 'registered', 'cancelled'])]),
  reason: z.string().optional(),
});
export type PersonEvent = z.infer<typeof PersonEvent>;

/** Un aviso de comportamiento. Solo los del curso. El número no viaja. */
export const Notice = z.object({
  id: Id,
  date: Day,
  reason: z.string(),
  placedBy: z.string().optional(),
  familyNotified: z.boolean(),
});
export type Notice = z.infer<typeof Notice>;

/** `GET /v1/people/:id` — la ficha. Se guarda: sin datos personales ni salud. */
export const ParticipantProfile = read({
  person: z.object({
    id: Id,
    firstName: z.string(),
    lastName: z.string(),
    fullName: z.string(),
    photoUrl: PhotoUrl.optional(),
    age: z.number().int().nonnegative().optional(),
    schoolLevel: SchoolLevel.optional(),
  }),
  /** `null` = sin grupo. */
  group: GroupSummary.nullable(),
  phones: z.object({
    own: z.string().optional(),
    emergency: z.string().optional(),
  }),
  /** Ya ordenada: `[0]` es el tutor 1 (el primero que se dio de alta). */
  guardians: z.array(Guardian),
  consents: Consents,
  badges: PersonBadges,
  scarf: Scarf,
  events: z.array(PersonEvent),
  notices: z.array(Notice),
  /** Cuántos avisos implican la salida del grupo (3). */
  noticeLimit: z.number().int().positive(),
  /** `null` = sin sábados que contar (sin grupo o sin inscripción). */
  attendance: z
    .object({
      sessions: z.array(SessionSummary),
      marks: z.record(Id, Mark),
      reasons: z.record(Id, z.string()),
    })
    .nullable(),
});
export type ParticipantProfile = z.infer<typeof ParticipantProfile>;

/**
 * `GET /v1/people/:id/personal` — los datos personales. NUNCA se guardan en
 * el móvil (decisión `offline`): solo con conexión.
 */
export const PersonalData = read({
  personId: Id,
  birthDate: Day.optional(),
  document: z.object({ kindLabel: z.string(), number: z.string() }).optional(),
  /** En una línea: «Calle Mayor 3, 12001 Villaclara». */
  address: z.string().optional(),
  /** La ciudad sola, para la cabecera del pliegue. */
  city: z.string().optional(),
  school: z.string().optional(),
  email: z.string().optional(),
  size: z.string().optional(),
  stageLabel: z.string().optional(),
  comLevelLabel: z.string().optional(),
  personNumber: z.string().optional(),
});
export type PersonalData = z.infer<typeof PersonalData>;

export const NOTICE_REASON_MAX = 1000;

/** `POST /v1/people/:id/notices` — una fecha futura la recorta el servidor a hoy. */
export const NoticeWrite = z.object({
  clientId: ClientId,
  date: Day,
  reason: z.string().max(NOTICE_REASON_MAX),
  familyNotified: z.boolean(),
  /** Desde la pantalla de marcar: la sesión de la que se viene. */
  sessionId: Id.optional(),
});
export type NoticeWrite = z.infer<typeof NoticeWrite>;
export const NoticeWriteResult = WriteResult.extend({ notice: Notice });
export type NoticeWriteResult = z.infer<typeof NoticeWriteResult>;

/** `PUT /v1/people/:id/scarf` */
export const ScarfWrite = z.object({ clientId: ClientId, scarf: SetScarf });
export type ScarfWrite = z.infer<typeof ScarfWrite>;

/**
 * `PUT /v1/memberships/:id/group` — poner grupo a una relación QUE YA EXISTE.
 * Solo coordinación; grupo y relación de su delegación. Nunca crea relaciones.
 */
export const MembershipGroupWrite = z.object({
  clientId: ClientId,
  groupId: Id,
});
export type MembershipGroupWrite = z.infer<typeof MembershipGroupWrite>;

/** Motivos de `validation` de las escrituras de Grupos y fichas. */
export const PEOPLE_REJECTIONS = ['empty_reason', 'season_closed'] as const;

// ── Coordinación (plan 06 «Datos») ──────────────────────────────────────────

/**
 * Un monitor del equipo de quien coordina o acompaña. `stage` es la sección
 * en la que sale (la de su curso más bajo); `otherStages`, las demás etapas en
 * las que también lleva grupo (para el «También lleva grupo de esta etapa…»).
 * `null` = «Sin etapa» (sin grupo de la delegación).
 */
export const TeamMember = z.object({
  id: Id,
  firstName: z.string(),
  lastName: z.string(),
  photoUrl: z.url().optional(),
  /** Códigos de sus grupos, en orden natural («C1», «C2»). */
  groupCodes: z.array(z.string()),
  stage: Stage.nullable(),
  otherStages: z.array(Stage),
  schoolLevel: SchoolLevel.optional(),
  /**
   * Tiene relación de monitor, pero no cuelga de ningún grupo de la
   * delegación (vacío, comodín o un grupo fuera de Pasar Lista). Solo lo ve
   * quien coordina toda la delegación. `membershipId` es la relación que se
   * vincula.
   */
  unassigned: z
    .object({ membershipId: Id, outsideGroupName: z.string().optional() })
    .optional(),
});
export type TeamMember = z.infer<typeof TeamMember>;

/** El recuento nocturno de un grupo. La app decide si es fresco (≤ 3 días). */
export const Headcount = z.object({
  participants: z.number().int().nonnegative(),
  monitors: z.number().int().nonnegative(),
  countedAt: Instant,
});
export type Headcount = z.infer<typeof Headcount>;

export const ROLL_CELLS = ['taken', 'skipped'] as const;
/** Una celda de la tira: `null` = falta (la sesión ya se celebró). */
export const RollCell = z.enum(ROLL_CELLS).nullable();
export type RollCell = z.infer<typeof RollCell>;

/** Las tiras de una etapa: sus sesiones celebradas y una fila por grupo. */
export const StageStrip = z.object({
  stage: Stage,
  /** Celebradas, de la más antigua a la más reciente (como mucho `stripLimit`). */
  sessions: z.array(SessionSummary),
  rows: z.array(
    z.object({
      group: z.object({
        id: Id,
        code: z.string().nullable(),
        name: z.string(),
      }),
      /** Quién lo lleva (relaciones de monitor vigentes). */
      monitors: z.array(z.object({ id: Id, name: z.string() })),
      /** Sin relaciones: el texto de monitores del grupo en el CRM. */
      monitorsText: z.string().optional(),
      headcount: Headcount.nullable(),
      /** Una por sesión de `sessions`, en el mismo orden. */
      cells: z.array(RollCell),
    }),
  ),
});
export type StageStrip = z.infer<typeof StageStrip>;

/** `GET /v1/coordination` — la pantalla «Coordinación». */
export const CoordinationHome = read({
  /** Solo a coordinación: la lista de monitores de la última sesión celebrada. */
  weeklyMonitorsRoll: z
    .object({ session: SessionSummary, rollCall: RollCallSummary.nullable() })
    .nullable(),
  /** Las tiras de la última sesión, de los grupos de tu alcance. */
  lastSession: z.array(StageStrip),
  team: z.array(TeamMember),
});
export type CoordinationHome = z.infer<typeof CoordinationHome>;

export const LoosePerson = z.object({
  id: Id,
  firstName: z.string(),
  lastName: z.string(),
  photoUrl: z.url().optional(),
});
export type LoosePerson = z.infer<typeof LoosePerson>;

/** `GET /v1/coordination/summary` — el Resumen de grupos (todo el equipo). */
export const CoordinationSummary = read({
  season: z.string(),
  /** Alcance acotado: `mine` es lo tuyo y `rest`, el resto de la delegación. */
  scoped: z.boolean(),
  stripLimit: z.number().int().positive(),
  mine: z.array(StageStrip),
  rest: z.array(StageStrip),
  review: z.object({
    participantsWithoutGroup: z.array(LoosePerson),
    groupsWithoutCode: z.array(z.object({ id: Id, name: z.string() })),
  }),
});
export type CoordinationSummary = z.infer<typeof CoordinationSummary>;

export const MONITORS_ROLL_KINDS = ['weekly', 'meeting'] as const;
export const MonitorsRollKind = z.enum(MONITORS_ROLL_KINDS);
export type MonitorsRollKind = z.infer<typeof MonitorsRollKind>;

export const MonitorsRollRow = z.object({
  member: TeamMember,
  /** `null` = sin asistencia todavía (se pinta y se guarda como «vino»). */
  mark: SetMark.nullable(),
  reason: z.string().nullable(),
  /** Una por sesión celebrada del evento de la lista, antigua → reciente. */
  seasonMarks: z.array(Mark),
});
export type MonitorsRollRow = z.infer<typeof MonitorsRollRow>;

/** `GET /v1/coordination/monitors-roll?kind=&stage=&session=` */
export const MonitorsRoll = read({
  kind: MonitorsRollKind,
  /**
   * Semanal: las etapas del alcance con evento (una lista por etapa, cada una
   * sobre su evento) y la que es esta. En una reunión, vacías y `null`.
   */
  stages: z.array(Stage),
  stage: Stage.nullable(),
  event: z.object({ id: Id, name: z.string() }).nullable(),
  session: SessionSummary.extend({ name: z.string().optional() }).nullable(),
  /** Todas las del evento (la app no ofrece las futuras). */
  sessions: z.array(SessionSummary),
  /** Las listas de monitores ya pasadas de ese evento (para el selector). */
  rollCalls: z.array(RollCallSummary),
  rollCall: RollCallSummary.nullable(),
  rows: z.array(MonitorsRollRow),
  /** De otra etapa, pero también llevan grupo de esta (no se marcan aquí). */
  borrowed: z.array(TeamMember),
});
export type MonitorsRoll = z.infer<typeof MonitorsRoll>;

/** `PUT /v1/sessions/:id/monitors-roll` — TODAS las filas, ninguna `null`. */
export const MonitorsRollWrite = z.object({
  clientId: ClientId,
  kind: MonitorsRollKind,
  marks: z.array(
    z.object({
      personId: Id,
      mark: SetMark,
      /** El servidor lo recorta a 255. */
      reason: z.string().optional(),
    }),
  ),
});
export type MonitorsRollWrite = z.infer<typeof MonitorsRollWrite>;
export const MonitorsRollWriteResult = WriteResult.extend({
  rollCall: RollCallSummary,
});
export type MonitorsRollWriteResult = z.infer<typeof MonitorsRollWriteResult>;

export const Meeting = z.object({
  session: SessionSummary,
  name: z.string(),
  durationHours: z.number().positive().nullable(),
  rollCall: RollCallSummary.nullable(),
});
export type Meeting = z.infer<typeof Meeting>;

/** `GET /v1/coordination/meetings` — de la más reciente a la más antigua. */
export const MeetingsResponse = read({
  season: z.string(),
  meetings: z.array(Meeting),
});
export type MeetingsResponse = z.infer<typeof MeetingsResponse>;

export const MEETING_DURATIONS = [1, 1.5, 2, 3, 4] as const;
export const MEETING_NAME_MAX = 120;

/** `POST /v1/meetings` — el servidor crea el evento del curso si no existe. */
export const MeetingWrite = z.object({
  clientId: ClientId,
  name: z.string().trim().min(1).max(MEETING_NAME_MAX),
  date: Day,
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationHours: z.union([
    z.literal(1),
    z.literal(1.5),
    z.literal(2),
    z.literal(3),
    z.literal(4),
  ]),
});
export type MeetingWrite = z.infer<typeof MeetingWrite>;
export const MeetingWriteResult = WriteResult.extend({ meeting: Meeting });
export type MeetingWriteResult = z.infer<typeof MeetingWriteResult>;

/** Un teléfono ya preparado por el servidor. */
export const Phone = z.object({
  /** Como está escrito: es lo que se reconoce. */
  display: z.string(),
  /** Para `tel:`. */
  tel: z.string(),
  /** Para `https://wa.me/…`. */
  whatsapp: z.string(),
});
export type Phone = z.infer<typeof Phone>;

/** Un cuadradito de una pista de asistencia de la ficha del monitor. */
export const Square = z.object({
  sessionId: Id,
  date: Day,
  /** En las reuniones, su nombre (es lo que las identifica). */
  name: z.string().optional(),
  mark: Mark,
  reason: z.string().optional(),
});
export type Square = z.infer<typeof Square>;

export const LIST_SQUARE_STATES = [
  'mine',
  'other',
  'skipped',
  'missing',
] as const;

const LabelValue = z.object({ label: z.string(), value: z.string() });

/** `GET /v1/monitors/:id` — la ficha del monitor (sin seguimientos). */
export const MonitorDetail = read({
  monitor: TeamMember.extend({
    age: z.number().int().nonnegative().optional(),
    monitorSinceYear: z.number().int().optional(),
    mobile: Phone.optional(),
    otherPhone: Phone.optional(),
    email: z.string().optional(),
    doNotCall: z.boolean(),
  }),
  /** Sábados (celebrados). `null` = sin evento de sesiones que mirar. */
  weekly: z
    .object({ registered: z.boolean(), squares: z.array(Square) })
    .nullable(),
  /** Reuniones de programación. `null` = no hay evento de reuniones. */
  meetings: z
    .object({ registered: z.boolean(), squares: z.array(Square) })
    .nullable(),
  /** Las listas de los grupos que lleva: quién las pasó. */
  rollCalls: z.array(
    z.object({
      group: z.object({ id: Id, code: z.string().nullable() }),
      squares: z.array(
        z.object({
          sessionId: Id,
          date: Day,
          state: z.enum(LIST_SQUARE_STATES),
        }),
      ),
    }),
  ),
  groups: z.array(
    z.object({
      group: z.object({
        id: Id,
        code: z.string().nullable(),
        name: z.string(),
        schoolLevels: z.array(z.string()),
        inRollCall: z.boolean(),
      }),
      /** `leads` = monitor del grupo; `member` = su grupo como miembro. */
      role: z.enum(['leads', 'member']),
      since: Day.optional(),
      counts: z.object({
        participants: z.number().int().nonnegative().nullable(),
        monitors: z.number().int().nonnegative(),
      }),
      colleagues: z.array(z.object({ id: Id, name: z.string() })),
    }),
  ),
  /** Por dónde ha pasado: solo relaciones de monitor, curso a curso. */
  history: z.array(
    z.object({
      season: z.string(),
      current: z.boolean(),
      groups: z.array(
        z.object({
          code: z.string().nullable(),
          name: z.string(),
          schoolLevels: z.array(z.string()),
          colleagues: z.array(z.string()),
        }),
      ),
    }),
  ),
  /** El papeleo, con las etiquetas ya traducidas por el servidor. */
  paperwork: z.object({
    compliance: z.array(
      z.object({
        label: z.string(),
        ok: z.boolean(),
        /** `false` = un permiso (LOPD, imágenes): un «no» no es incumplir. */
        required: z.boolean(),
        note: z.string().optional(),
      }),
    ),
    mcm: z.array(LabelValue),
    training: z.array(
      z.object({
        label: z.string(),
        value: z.string(),
        ok: z.boolean(),
        note: z.string().optional(),
        warn: z.string().optional(),
      }),
    ),
    congresses: z.array(z.string()),
    academic: z.string().optional(),
    personal: z.array(LabelValue),
  }),
});
export type MonitorDetail = z.infer<typeof MonitorDetail>;

export const FOLLOW_UP_TYPES = [
  'incident',
  'assessment',
  'accompaniment',
] as const;
export const FollowUpType = z.enum(FOLLOW_UP_TYPES);
export type FollowUpType = z.infer<typeof FollowUpType>;

export const FollowUp = z.object({
  id: Id,
  type: FollowUpType,
  /** La fecha del HECHO. `null` = sin fecha (sale siempre, en cualquier curso). */
  date: Day.nullable(),
  text: z.string(),
  author: z.string(),
});
export type FollowUp = z.infer<typeof FollowUp>;

/**
 * `GET /v1/monitors/:id/follow-ups` — NUNCA se guarda en el móvil: es lo que
 * una persona escribió sobre otra. Todos los cursos (la app filtra). Sobre uno
 * mismo, `readable` y `writable` vacíos.
 */
export const FollowUpsResponse = read({
  readable: z.array(FollowUpType),
  writable: z.array(FollowUpType),
  items: z.array(FollowUp),
});
export type FollowUpsResponse = z.infer<typeof FollowUpsResponse>;

export const FOLLOW_UP_TEXT_MAX = 4000;

/** `POST /v1/monitors/:id/follow-ups` */
export const FollowUpWrite = z.object({
  clientId: ClientId,
  type: FollowUpType,
  date: Day,
  text: z.string().trim().min(1).max(FOLLOW_UP_TEXT_MAX),
});
export type FollowUpWrite = z.infer<typeof FollowUpWrite>;
export const FollowUpWriteResult = WriteResult.extend({ item: FollowUp });
export type FollowUpWriteResult = z.infer<typeof FollowUpWriteResult>;

/** `POST /v1/events/:id/sessions/today` — si ya existe, se reutiliza. */
export const SessionTodayWrite = z.object({ clientId: ClientId });
export type SessionTodayWrite = z.infer<typeof SessionTodayWrite>;
export const SessionTodayResult = WriteResult.extend({
  session: SessionSummary,
});
export type SessionTodayResult = z.infer<typeof SessionTodayResult>;

/** Motivos de `validation` de las escrituras de coordinación. */
export const COORDINATION_REJECTIONS = [
  'session_in_future',
  'wrong_kind',
  'bad_type',
] as const;

// ── Salud (lo único que lleva texto de salud; nunca se guarda) ──────────────

export const HEALTH_KINDS = [
  'allergies',
  'intolerances',
  'treatments',
  'illnesses',
  'other',
] as const;
export const HealthKind = z.enum(HEALTH_KINDS);
export type HealthKind = z.infer<typeof HealthKind>;

/**
 * `GET /v1/people/:id/health` — solo con `Me.canSeeHealth`, solo con conexión
 * y nunca en el móvil. Solo los campos con texto; vacío = nada que decir.
 */
export const HealthNote = read({
  personId: Id,
  items: z.array(z.object({ kind: HealthKind, text: z.string() })),
});
export type HealthNote = z.infer<typeof HealthNote>;

// ── Rutas ───────────────────────────────────────────────────────────────────

/**
 * Catálogo de lo que hay hoy en el contrato, para los tests que lo recorren
 * (cada ruta tiene datos en el servidor falso; ninguna lectura que se guarda
 * lleva texto de salud).
 */
export const ROUTES = {
  code: {
    method: 'POST',
    path: '/v1/auth/code',
    response: CodeResponse,
    persist: false,
  },
  verify: {
    method: 'POST',
    path: '/v1/auth/verify',
    response: VerifyResponse,
    persist: false,
  },
  refresh: {
    method: 'POST',
    path: '/v1/auth/refresh',
    response: RefreshResponse,
    persist: false,
  },
  exchange: {
    method: 'POST',
    path: '/v1/auth/exchange',
    response: VerifyResponse,
    persist: false,
  },
  webPass: {
    method: 'POST',
    path: '/v1/web-pass',
    response: WebPass,
    persist: false,
  },
  me: { method: 'GET', path: '/v1/me', response: MeResponse, persist: true },
  groups: {
    method: 'GET',
    path: '/v1/groups',
    response: GroupsResponse,
    persist: true,
  },
  today: {
    method: 'GET',
    path: '/v1/today',
    response: TodayResponse,
    persist: true,
  },
  roll: {
    method: 'GET',
    path: '/v1/sessions/:sid/groups/:gid/roll',
    response: RollDetail,
    persist: true,
  },
  saveRoll: {
    method: 'PUT',
    path: '/v1/sessions/:sid/groups/:gid/roll',
    response: RollWriteResult,
    persist: false,
  },
  health: {
    method: 'GET',
    path: '/v1/people/:id/health',
    response: HealthNote,
    persist: false,
  },
  people: {
    method: 'GET',
    path: '/v1/people',
    response: PeopleIndex,
    persist: true,
  },
  group: {
    method: 'GET',
    path: '/v1/groups/:id',
    response: GroupDetail,
    persist: true,
  },
  person: {
    method: 'GET',
    path: '/v1/people/:id',
    response: ParticipantProfile,
    persist: true,
  },
  personal: {
    method: 'GET',
    path: '/v1/people/:id/personal',
    response: PersonalData,
    persist: false,
  },
  createNotice: {
    method: 'POST',
    path: '/v1/people/:id/notices',
    response: NoticeWriteResult,
    persist: false,
  },
  setScarf: {
    method: 'PUT',
    path: '/v1/people/:id/scarf',
    response: WriteResult,
    persist: false,
  },
  assignGroup: {
    method: 'PUT',
    path: '/v1/memberships/:id/group',
    response: WriteResult,
    persist: false,
  },
  coordination: {
    method: 'GET',
    path: '/v1/coordination',
    response: CoordinationHome,
    persist: true,
  },
  summary: {
    method: 'GET',
    path: '/v1/coordination/summary',
    response: CoordinationSummary,
    persist: true,
  },
  monitorsRoll: {
    method: 'GET',
    path: '/v1/coordination/monitors-roll',
    response: MonitorsRoll,
    persist: true,
  },
  saveMonitorsRoll: {
    method: 'PUT',
    path: '/v1/sessions/:id/monitors-roll',
    response: MonitorsRollWriteResult,
    persist: false,
  },
  meetings: {
    method: 'GET',
    path: '/v1/coordination/meetings',
    response: MeetingsResponse,
    persist: true,
  },
  createMeeting: {
    method: 'POST',
    path: '/v1/meetings',
    response: MeetingWriteResult,
    persist: false,
  },
  monitor: {
    method: 'GET',
    path: '/v1/monitors/:id',
    response: MonitorDetail,
    persist: true,
  },
  followUps: {
    method: 'GET',
    path: '/v1/monitors/:id/follow-ups',
    response: FollowUpsResponse,
    // Lo que una persona escribió sobre otra: como la salud, nunca al disco.
    persist: false,
  },
  createFollowUp: {
    method: 'POST',
    path: '/v1/monitors/:id/follow-ups',
    response: FollowUpWriteResult,
    persist: false,
  },
  sessionToday: {
    method: 'POST',
    path: '/v1/events/:id/sessions/today',
    response: SessionTodayResult,
    persist: false,
  },
} as const;
export type RouteName = keyof typeof ROUTES;

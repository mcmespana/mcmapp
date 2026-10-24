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
// (plan 04 «Datos») y el de Grupos y fichas (plan 05). Cada plan de
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
  photoUrl: z.url().optional(),
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
  photoUrl: z.url().optional(),
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

/** `PUT /v1/sessions/:sid/groups/:gid/roll` */
export const RollWrite = z.object({
  clientId: ClientId,
  action: z.enum(['save', 'skip']),
  marks: z.record(Id, SetMark),
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
  photoUrl: z.url().optional(),
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
    photoUrl: z.url().optional(),
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
} as const;
export type RouteName = keyof typeof ROUTES;

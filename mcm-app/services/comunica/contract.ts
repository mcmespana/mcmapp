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
// Este fichero tiene lo compartido (plan 00 §3) y el trozo de Pasar Lista
// (plan 04 «Datos»), que es el primero que se construye. Cada plan de
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
    participants: z.number().int().nonnegative(),
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

// ── Salud (lo único que lleva texto de salud; nunca se guarda) ──────────────

export const HealthNote = read({ personId: Id, text: z.string() });
export type HealthNote = z.infer<typeof HealthNote>;

// ── Rutas ───────────────────────────────────────────────────────────────────

/**
 * Catálogo de lo que hay hoy en el contrato, para los tests que lo recorren
 * (cada ruta tiene datos en el servidor falso; ninguna lectura que se guarda
 * lleva texto de salud).
 */
export const ROUTES = {
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
} as const;
export type RouteName = keyof typeof ROUTES;

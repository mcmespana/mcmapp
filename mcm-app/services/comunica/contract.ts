/* eslint-disable max-lines -- un solo contrato: docs/desarrollo/WARNINGS.md §3 */
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
// pantallas añade aquí su trozo al ejecutarse. Avisos en el móvil: plan 08.

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
  /** La de su ficha: manda en lo personal (eventos, inscripciones, pagos). */
  delegation: Delegation,
  /**
   * La de la ficha (la primera) y cada una donde tenga una relación VIGENTE de
   * monitor, coordinación o acompañamiento (plan 17). Con más de una, sale el
   * selector de la delegación de trabajo. Sin el campo, solo la de la ficha.
   */
  teamDelegations: z.array(Delegation).optional(),
  /** Papeles y alcance EN la delegación de trabajo (la de la cabecera). */
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

// ── Familias: a quién se ve (plan 11) ───────────────────────────────────────

/**
 * Una persona que se puede ver: quien ha entrado o uno de sus hijos. Los
 * nombres pueden faltar (`null`): un hijo cuyo nombre no llega sale igual
 * («Participante» en pantalla: perder el acceso es peor que un nombre feo).
 * `gender` sirve para «Yo mismo» / «Yo misma».
 */
export const ProfileRef = z.object({
  id: Id,
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  gender: z.enum(['female', 'male']).nullable(),
});
export type ProfileRef = z.infer<typeof ProfileRef>;

/**
 * `GET /v1/me/profiles[?fresh=1]`: quien ha entrado y a quiénes tiene a cargo
 * (relación vigente de padre, madre, tutor o cuidador). Si el CRM no contesta,
 * `crm_unavailable`: NUNCA `children: []`. Todo lo de familias cuelga de
 * `/v1/profiles/:pid/…` y el servidor comprueba en cada petición que `pid` es
 * `self` o uno de `children` (si no, `forbidden`, 403, nunca 404).
 */
export const MyProfiles = read({
  self: ProfileRef,
  children: z.array(ProfileRef),
});
export type MyProfiles = z.infer<typeof MyProfiles>;

// ── Familias: eventos y su ficha (plan 13) ──────────────────────────────────
//
// Todo cuelga de `/v1/profiles/:pid/…`. Días `YYYY-MM-DD` de Madrid. Ni un nombre del CRM ni una cadena de HTML: el cuerpo viaja troceado en
// BLOQUES (`BodyBlock`) y la app los pinta con componentes nativos. Las imágenes y los archivos `{ documentId }` se bajan con sesión por
// `/v1/profiles/:pid/events/:eventId/documents/:documentId` (binario, no es una ruta del catálogo).

export const ACTIVITY_TONES = ['ok', 'warn', 'danger', 'neutral'] as const;

/** Un archivo del evento (`{ documentId }`, se baja con sesión por la ruta de documentos) o una imagen de fuera (`{ url }`). */
export const ImageRef = z.union([
  z.strictObject({ documentId: Id }),
  z.strictObject({ url: z.url({ protocol: /^https?$/ }) }),
]);
export type ImageRef = z.infer<typeof ImageRef>;
export const BodyHref = z.union([
  z.strictObject({ url: z.string().min(1) }),
  z.strictObject({ documentId: Id }),
]);
export type BodyHref = z.infer<typeof BodyHref>;

export type BodyInline =
  | { t: 'text'; v: string }
  | { t: 'bold' | 'italic'; c: BodyInline[] }
  | { t: 'link'; href: BodyHref; c: BodyInline[] }
  | { t: 'break' };
export const BodyInline: z.ZodType<BodyInline> = z.lazy(() =>
  z.union([
    z.strictObject({ t: z.literal('text'), v: z.string() }),
    z.strictObject({ t: z.enum(['bold', 'italic']), c: z.array(BodyInline) }),
    z.strictObject({
      t: z.literal('link'),
      href: BodyHref,
      c: z.array(BodyInline),
    }),
    z.strictObject({ t: z.literal('break') }),
  ]),
);

export const BodyBlock = z.union([
  z.strictObject({
    type: z.literal('heading'),
    level: z.union([z.literal(1), z.literal(2)]),
    text: z.array(BodyInline),
  }),
  z.strictObject({
    type: z.enum(['paragraph', 'notice']),
    text: z.array(BodyInline),
  }),
  z.strictObject({
    type: z.literal('list'),
    ordered: z.boolean(),
    start: z.number().int(),
    items: z.array(z.array(BodyInline)),
    children: z.record(
      z.string(),
      z.strictObject({
        ordered: z.boolean(),
        items: z.array(z.array(BodyInline)),
      }),
    ),
  }),
  z.strictObject({
    type: z.literal('button'),
    label: z.string(),
    href: BodyHref,
  }),
  z.strictObject({
    type: z.literal('image'),
    src: ImageRef,
    caption: z.string().optional(),
    alt: z.string().optional(),
  }),
  z.strictObject({ type: z.literal('gallery'), images: z.array(ImageRef) }),
  z.strictObject({
    type: z.literal('video'),
    provider: z.enum(['youtube', 'vimeo']),
    id: z.string(),
    url: z.string(),
  }),
  z.strictObject({ type: z.literal('divider') }),
]);
export type BodyBlock = z.infer<typeof BodyBlock>;

export const EventCard = z.object({
  id: Id,
  name: z.string(),
  startDate: Day.nullable(),
  endDate: Day.nullable(),
  /** El lugar y, si no, la dirección. */
  place: z.string().nullable(),
  /** La etiqueta del CRM; la de `registration` ya es «Inscripciones abiertas». */
  statusLabel: z.string().nullable(),
  window: z.object({ opensOn: Day.nullable(), closesOn: Day.nullable() }),
  hasAdvancedForm: z.boolean(),
  /** La inscripción NO cancelada de este perfil, si la tiene. */
  myRegistrationId: Id.nullable(),
  myRegistrationStatus: z
    .object({ label: z.string(), tone: z.enum(ACTIVITY_TONES) })
    .nullable(),
});
export type EventCard = z.infer<typeof EventCard>;

/** `toSignUp` (sin los ocultos ni los que no son para este perfil) y `signedUp` (con plaza: sin audiencia ni ocultos). */
export const ActivityList = read({
  toSignUp: z.array(EventCard),
  signedUp: z.array(EventCard),
});
export type ActivityList = z.infer<typeof ActivityList>;

export const EventAudience = z.union([
  z.strictObject({ ok: z.literal(true) }),
  z.strictObject({
    ok: z.literal(false),
    reason: z.enum(['delegation', 'profile', 'course']),
    message: z.string(),
  }),
]);
export type EventAudience = z.infer<typeof EventAudience>;

export const EventDetail = read({
  ...EventCard.shape,
  tagline: z.string().nullable(),
  /** Texto plano, saltos de línea incluidos. Solo si no hay información de la web (nunca las dos). */
  description: z.string().nullable(),
  timetable: z.string().nullable(),
  address: z.string().nullable(),
  /** `null` si es 0: un 0 no es un dato. */
  capacity: z.number().int().nullable(),
  price: z.number().nullable(),
  map: z
    .union([
      z.strictObject({ url: z.string() }),
      z.strictObject({ query: z.string() }),
    ])
    .nullable(),
  cover: ImageRef.nullable(),
  body: z.array(BodyBlock),
  gallery: z.array(ImageRef),
  attachments: z.array(z.strictObject({ documentId: Id, title: z.string() })),
  /** Solo si está publicada. */
  publicUrl: z.string().nullable(),
  /** El enlace para compartir (plan 08): la página pública si la hay. */
  share: z
    .strictObject({ url: z.string(), kind: z.enum(['public', 'area']) })
    .nullable(),
  signup: z.strictObject({ audience: EventAudience }).nullable(),
});
export type EventDetail = z.infer<typeof EventDetail>;

// ── Familias: inscripciones (plan 14) ───────────────────────────────────────
//
// Todo cuelga de `/v1/profiles/:pid/…`. La persona inscrita es SIEMPRE `pid`: paga quien ha entrado y ninguna de las dos personas viaja en el
// cuerpo. El IBAN solo con domiciliación y NUNCA a una caché, una cola, un log ni una respuesta: solo vive en el estado del formulario.

export const PAYMENT_METHODS = [
  'bizum',
  'transfer',
  'transfer_received',
  'cash',
  'direct_debit',
  'card',
] as const;
export const PaymentMethod = z.enum(PAYMENT_METHODS);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

export const RegistrationStatus = z.object({
  /** Vacía = sin chip. La etiqueta sale de una tabla fija (las del CRM no se leen por SQL: duda 25 de docs/FASE3.md). */
  label: z.string(),
  tone: z.enum(ACTIVITY_TONES),
});
export type RegistrationStatus = z.infer<typeof RegistrationStatus>;

export const RegistrationCard = z.object({
  id: Id,
  title: z.string(),
  eventId: Id.nullable(),
  eventStart: Day.nullable(),
  eventEnd: Day.nullable(),
  signedOn: Day.nullable(),
  schoolLevel: z.string().nullable(),
  classLabel: z.string().nullable(),
  status: RegistrationStatus,
  eventHidden: z.boolean(),
});
export type RegistrationCard = z.infer<typeof RegistrationCard>;

/** `GET /v1/profiles/:pid/registrations`. Todas (también canceladas y rechazadas, con su chip); la app las ordena. */
export const RegistrationsList = read({ items: z.array(RegistrationCard) });
export type RegistrationsList = z.infer<typeof RegistrationsList>;

export const Question = z.object({
  n: z.union([z.literal(1), z.literal(2)]),
  prompt: z.string().nullable(),
  options: z.array(z.string()).min(2),
});
export type Question = z.infer<typeof Question>;

export const SpecialNeedsDef = z.object({
  label: z.string(),
  options: z.array(z.object({ value: z.string(), label: z.string() })),
  yesValue: z.string(),
  descriptionLabel: z.string(),
});
export type SpecialNeedsDef = z.infer<typeof SpecialNeedsDef>;

export const PaymentState = z.object({
  state: z.enum([
    'pending',
    'returned',
    'paid',
    'direct_debit',
    'no_commitment',
    'none',
  ]),
  amount: z.number().nullable(),
  method: PaymentMethod.nullable(),
  methodLabel: z.string().nullable(),
  date: Day.nullable(),
  paymentId: Id.nullable(),
});
export type PaymentState = z.infer<typeof PaymentState>;

export const RegistrationDetail = RegistrationCard.extend({
  generatedAt: Instant,
  amount: z.number().nullable(),
  participation: z.string().nullable(),
  attendancePercent: z.number().nullable(),
  attendees: z.number().int(),
  answers: z.array(z.string()),
  specialNeeds: z.string().nullable(),
  specialNeedsDescription: z.string().nullable(),
  contacts: z.array(
    z.object({
      name: z.string(),
      relationship: z.string().nullable(),
      phone: z.string().nullable(),
      email: z.string().nullable(),
    }),
  ),
  payment: PaymentState,
  manage: z.object({
    canEdit: z.boolean(),
    canCancel: z.boolean(),
    reason: z.string().nullable(),
    until: Day.nullable(),
  }),
  edit: z
    .object({
      questions: z.array(
        Question.extend({ current: z.number().int().nullable() }),
      ),
      specialNeeds: SpecialNeedsDef,
    })
    .nullable(),
});
export type RegistrationDetail = z.infer<typeof RegistrationDetail>;

/**
 * `PATCH /v1/profiles/:pid/registrations/:rid`: SOLO las respuestas (número de opción desde 1, de las preguntas de ese evento: todas) y las
 * necesidades especiales (la descripción solo si es «sí»). Estricto. Sin derechos (cancelada, evento pasado, plazo cerrado), `conflict`
 * `window_closed` y no se toca nada.
 */
export const RegistrationEdit = z.strictObject({
  clientId: ClientId,
  answers: z
    .array(
      z.strictObject({
        n: z.union([z.literal(1), z.literal(2)]),
        option: z.number().int().min(1).max(20),
      }),
    )
    .max(2),
  specialNeeds: z.string().max(50).nullable().optional(),
  specialNeedsDescription: z.string().max(255).nullable().optional(),
});
export type RegistrationEdit = z.infer<typeof RegistrationEdit>;

/** `POST /v1/profiles/:pid/registrations/:rid/cancel`. */
export const RegistrationCancel = z.strictObject({ clientId: ClientId });
export type RegistrationCancel = z.infer<typeof RegistrationCancel>;
export const RegistrationWriteResult = WriteResult;
export type RegistrationWriteResult = z.infer<typeof RegistrationWriteResult>;

// ── Apuntarse (plan 14b) ────────────────────────────────────────────────────

/**
 * `GET /v1/profiles/:pid/events/:eventId/signup`: lo que la app necesita para el alta corta, y por qué no se puede (si no). El servidor
 * vuelve a comprobarlo todo al enviar: lo que enseña la app es cortesía. Los medios de pago son los que el servidor tiene activados
 * (`MW_PAYMENT_METHODS`; por defecto domiciliación y tarjeta, las únicas vistas en el CRM): nunca se escribe una clave a ciegas.
 */
export const SignupBlocked = z.union([
  z.object({ reason: z.literal('already_registered'), registrationId: Id }),
  z.object({
    reason: z.enum(['audience', 'window']),
    title: z.string(),
    message: z.string(),
  }),
  z.object({ reason: z.literal('advanced_form') }),
]);
export type SignupBlocked = z.infer<typeof SignupBlocked>;

export const SignupForm = read({
  event: z.object({
    id: Id,
    name: z.string(),
    startDate: Day.nullable(),
    endDate: Day.nullable(),
    description: z.string().nullable(),
  }),
  blocked: SignupBlocked.nullable(),
  questions: z.array(Question),
  price: z.number().nullable(),
  paymentMethods: z.array(z.object({ key: PaymentMethod, label: z.string() })),
  specialNeeds: SpecialNeedsDef,
});
export type SignupForm = z.infer<typeof SignupForm>;

/**
 * `POST /v1/profiles/:pid/registrations`: la persona inscrita es SIEMPRE `pid`; paga quien ha entrado (y el hijo, si es el caso, es el
 * destinatario): ninguna de las dos personas viaja en el cuerpo. El IBAN solo con domiciliación (si no, el esquema lo rechaza) y nunca
 * llega al diario, a un log ni a una respuesta. Respuestas: número de opción desde 1.
 */
export const SignupWrite = z
  .strictObject({
    clientId: ClientId,
    eventId: Id,
    answers: z
      .array(
        z.strictObject({
          n: z.union([z.literal(1), z.literal(2)]),
          option: z.number().int().min(1).max(20),
        }),
      )
      .max(2),
    payment: z
      .strictObject({
        method: PaymentMethod,
        iban: z.string().max(60).optional(),
      })
      .nullable(),
    specialNeeds: z.string().max(50).nullable().optional(),
    specialNeedsDescription: z.string().max(255).nullable().optional(),
  })
  .refine(
    (w) =>
      !w.payment ||
      w.payment.iban === undefined ||
      w.payment.method === 'direct_debit',
    {
      path: ['payment', 'iban'],
      message: 'El IBAN es solo para la domiciliación.',
    },
  );
export type SignupWrite = z.infer<typeof SignupWrite>;

/** `payment`: `none` (sin precio o sin medio), `noted` (compromiso anotado) o `error` (la inscripción queda y el pago no se pudo anotar). */
export const SignupResult = WriteResult.extend({
  registrationId: Id,
  payment: z.enum(['none', 'noted', 'error']),
  cardPaymentId: Id.nullable(),
});
export type SignupResult = z.infer<typeof SignupResult>;

/** `POST /v1/profiles/:pid/events/:eventId/advanced-form` → la URL del formulario del CRM con los datos de `pid` ya puestos. */
export const AdvancedFormResult = z.object({
  url: z.url({ protocol: /^https?$/ }),
});
export type AdvancedFormResult = z.infer<typeof AdvancedFormResult>;

// ── Familias: pagos y pagar con tarjeta (plan 15) ───────────────────────────
//
// Todo cuelga de `/v1/profiles/:pid/…`. El dinero es DE QUIEN PAGA: viéndose a sí mismo, todo lo que paga (con «para Lucía»); viendo a un hijo, solo
// lo de ese hijo. Importes en CÉNTIMOS. El IBAN entero nunca viaja (`accountMasked`). La app enseña, arranca y pregunta; el servidor prepara, reclama y
// decide: la app NUNCA concluye «pagado» por su cuenta. Nada de esto se guarda en el móvil (salvo el intento en curso, sin importes).

export const PAYMENT_STATUSES = [
  'pending',
  'scheduled',
  'paid',
  'failed',
  'other',
] as const;
/** `scheduled` = domiciliación en remesa; `failed` = devuelto o rechazado. */
export const PayStatus = z.enum(PAYMENT_STATUSES);
export type PayStatus = z.infer<typeof PayStatus>;

export const PAY_METHODS = [
  'card',
  'direct_debit',
  'bizum',
  'transfer',
  'cash',
  'other',
] as const;
/** `transfer_received` → `transfer`; lo que no se conoce (`kind`, «Especie»…) → `other`. */
export const PayMethod = z.enum(PAY_METHODS);
export type PayMethod = z.infer<typeof PayMethod>;

export const Payment = z.object({
  id: Id,
  title: z.string(),
  /** Nombre de pila del destinatario, si no es quien se ve. */
  forName: z.string().optional(),
  date: Day.nullable(),
  amountCents: z.number().int(),
  status: PayStatus,
  statusLabel: z.string(),
  method: PayMethod,
  methodLabel: z.string(),
  canPayByCard: z.boolean(),
  /** Hay un intento con vuelta «ok» del banco que el CRM aún no da por cobrado: no se ofrece pagar otra vez. */
  confirmingSince: Instant.optional(),
});
export type Payment = z.infer<typeof Payment>;

/** `GET /v1/profiles/:pid/payments`: sin intentos de tarjeta sin cobrar, sin lo pendiente de un compromiso cerrado y sin lo anulado. */
export const PaymentsList = read({ payments: z.array(Payment) });
export type PaymentsList = z.infer<typeof PaymentsList>;

export const PaymentDetail = Payment.extend({
  generatedAt: Instant,
  typeLabel: z.string().optional(),
  accountMasked: z.string().optional(),
  bankingConcept: z.string().optional(),
  inKindDescription: z.string().optional(),
  transactionCode: z.string().optional(),
  rejection: z
    .object({ reason: z.string().optional(), date: Day.optional() })
    .optional(),
  registrationId: Id.optional(),
});
export type PaymentDetail = z.infer<typeof PaymentDetail>;

/**
 * `GET /v1/profiles/:pid/card-checkout?payment=<id>` o `?registration=<id>`: si se puede pagar con tarjeta y qué se pagaría. SOLO LEE:
 * no crea ningún intento ni escribe en el CRM. `payer` es quien ha entrado (el familiar, si se ve a un hijo), tal cual está en su ficha.
 */
export const CardCheckout = read({
  checkout: z.union([
    z.object({
      payable: z.literal(true),
      concept: z.string(),
      amountCents: z.number().int().positive(),
      payer: z.object({ name: z.string(), email: z.string() }),
      forName: z.string().optional(),
      returnTo: z.union([
        z.object({ registration: Id }),
        z.literal('payments'),
      ]),
    }),
    z.object({
      payable: z.literal(false),
      reason: z.enum(['not_payable', 'missing_payer_data', 'nothing_to_pay']),
    }),
  ]),
});
export type CardCheckout = z.infer<typeof CardCheckout>;

// ── Pagar con tarjeta de verdad (plan 15b) ──────────────────────────────────

export const CardChannel = z.enum(['sheet', 'browser']);
/** `POST /v1/profiles/:pid/card-attempts`: de dónde sale el pago (nunca un donativo), el importe en céntimos (mínimo 1 €, sin tope) y cómo se abre la pasarela. */
export const CardAttemptCreate = z.strictObject({
  clientId: ClientId,
  source: z.union([
    z.strictObject({ payment: Id }),
    z.strictObject({ registration: Id }),
  ]),
  amountCents: z.number().int().min(100).max(100_000_000),
  channel: CardChannel,
});
export type CardAttemptCreate = z.infer<typeof CardAttemptCreate>;

/**
 * `launchUrl`: una página del servidor de UN SOLO USO (caduca en 10 min) que manda al banco; `returnUrlPrefix`: pública y sin datos, la app corta la
 * navegación cuando la URL empieza por ella y lee `ok` o `ko`.
 */
export const CardAttempt = z.object({
  attemptId: Id,
  launchUrl: z.url({ protocol: /^https$/ }),
  returnUrlPrefix: z.url({ protocol: /^https$/ }),
  expiresAt: Instant,
});
export type CardAttempt = z.infer<typeof CardAttempt>;

export const CardAttemptState = z.enum([
  'started',
  'confirming',
  'paid',
  'failed',
  'abandoned',
]);
/** `POST …/card-attempts/:id/check`: lo que la app vio al volver (si vio algo). El estado lo decide SIEMPRE el servidor, con el cobro del CRM. */
export const CardAttemptCheck = z.strictObject({
  returned: z.enum(['ok', 'ko', 'closed']).optional(),
});
export type CardAttemptCheck = z.infer<typeof CardAttemptCheck>;
export const CardAttemptStatus = z.object({
  attemptId: Id,
  state: CardAttemptState,
  paidCents: z.number().int().optional(),
  registrationId: Id.optional(),
  paymentId: Id.optional(),
});
export type CardAttemptStatus = z.infer<typeof CardAttemptStatus>;

/**
 * Lo que devuelve crear un intento: el de verdad (`launchUrl`, la pasarela del banco) o, SOLO con el servidor falso, `simulated: true` (la hoja pinta
 * una pasarela de mentira). Un `simulated` de un servidor que no es el falso es un error (lo comprueba `client.ts`).
 */
export const SimulatedAttempt = z.object({
  attemptId: Id,
  simulated: z.literal(true),
});
export type SimulatedAttempt = z.infer<typeof SimulatedAttempt>;
export type CardAttemptResult = CardAttempt | SimulatedAttempt;

// ── Familias: documentos y calendario (plan 16) ─────────────────────────────
//
// Todo cuelga de `/v1/profiles/:pid/…`. Los DOCUMENTOS no se guardan en el móvil (un nombre como «Informe médico» ya es sensible) y no van por la cola:
// subir, editar y borrar son llamadas directas, con conexión y con `clientId`. El archivo: hasta 4 MB (lo que cabe en Vercel). El CALENDARIO sí se guarda
// (actividades, fechas y marcas; ni documento, ni dirección, ni correo).

const DocText = z.string().nullable();
const KeyLabel = z.object({ key: z.string(), label: z.string() });

// ── Documentos ──────────────────────────────────────────────────────────────

/** Los documentos de la relación `documents` del perfil. Sin el contenido ni la descripción: eso, en la ficha. */
export const DocumentSummary = z.object({
  id: Id,
  name: z.string(),
  /** El del archivo de su revisión actual (con su extensión), o `null` si no tiene archivo. */
  fileName: DocText,
  status: KeyLabel.nullable(),
  activeOn: Day.nullable(),
  expiresOn: Day.nullable(),
});
export type DocumentSummary = z.infer<typeof DocumentSummary>;

export const DocumentDetail = DocumentSummary.extend({
  description: DocText,
  category: KeyLabel.nullable(),
  sharedLink: DocText,
});
export type DocumentDetail = z.infer<typeof DocumentDetail>;

/** `GET /v1/profiles/:pid/documents`: sin caché; nunca en el móvil. Lo más reciente primero y lo caducado al final. */
export const DocumentsResponse = read({ documents: z.array(DocumentSummary) });
export type DocumentsResponse = z.infer<typeof DocumentsResponse>;

/** `GET /v1/profiles/:pid/documents/:id`: uno ajeno, borrado o inexistente es `forbidden` (nunca «no es tuyo»). */
export const DocumentResponse = read({ document: DocumentDetail });
export type DocumentResponse = z.infer<typeof DocumentResponse>;

/**
 * `POST /v1/profiles/:pid/documents` (multipart: estos campos y `file`) y `PATCH /v1/profiles/:pid/documents/:id` (multipart: `clientId`
 * y lo que cambia, `name`, `description` y/o `file`). El archivo: hasta 4 MB (lo que cabe en Vercel), una extensión de la lista
 * (`DOCUMENT_EXTENSIONS`) y un contenido que es de lo que dice la extensión. La descripción vacía la deja vacía.
 */
export const DocumentFields = z.object({
  clientId: ClientId,
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
});
export const DocumentPatchFields = z.object({
  clientId: ClientId,
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
});
/** `DELETE /v1/profiles/:pid/documents/:id?clientId=`: nunca por GET, solo con el token en la cabecera. */
export const DocumentDeleteQuery = z.object({ clientId: ClientId });

// ── Calendario ──────────────────────────────────────────────────────────────

/**
 * Una sesión de un evento en el que el perfil tiene inscripción NO cancelada. `attendance` es la marca de su asistencia (`null` = sin
 * registrar); «parcial» y «justificada» las junta la app con las otras dos mientras sus estados estén apagados (regla C4 del plan).
 */
export const CalendarSession = z.object({
  id: Id,
  name: z.string(),
  eventId: Id,
  eventName: z.string(),
  startsAt: Instant,
  endsAt: Instant.nullable(),
  attendance: Mark,
});
export type CalendarSession = z.infer<typeof CalendarSession>;

export const CalendarEvent = z.object({
  id: Id,
  name: z.string(),
  startDate: Day,
  endDate: Day.nullable(),
});
export type CalendarEvent = z.infer<typeof CalendarEvent>;

/**
 * `GET /v1/profiles/:pid/calendar`: ventana de 14 meses atrás a 12 adelante. `openEvents` va filtrado por la audiencia del perfil, sin
 * los ocultos y sin los que ya tienen plaza; `registeredEvents` no (es su agenda); las inscripciones canceladas no cuentan.
 */
export const CalendarData = read({
  sessions: z.array(CalendarSession),
  registeredEvents: z.array(CalendarEvent),
  openEvents: z.array(CalendarEvent),
});
export type CalendarData = z.infer<typeof CalendarData>;

export const SessionDetail = CalendarSession.extend({ description: DocText });
export type SessionDetail = z.infer<typeof SessionDetail>;
/** `GET /v1/profiles/:pid/sessions/:id`: solo con inscripción activa a su evento; si no, `forbidden`. */
export const SessionResponse = read({ session: SessionDetail });
export type SessionResponse = z.infer<typeof SessionResponse>;

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

/**
 * `POST /v1/auth/app-account` — entrar con la cuenta de Google o Apple de la app (decisión `identidad-app`): el `idToken` de
 * Firebase de quien ha entrado en la app. Responde como `verify` (también «¿Quién eres?»: se repite con `personId`). Motivos de
 * `validation`: `bad_app_token` (pase no válido o caducado: pedir otro) y `no_match` (ese correo no está en el CRM: ofrecer el
 * código o el DNI).
 */
export const AppAccountRequest = z.object({
  idToken: z.string().min(20).max(4096),
  personId: Id.optional(),
});
export type AppAccountRequest = z.infer<typeof AppAccountRequest>;

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
  /**
   * La delegación del grupo (plan 17). Se sirve cualquier grupo de las
   * delegaciones del equipo: si no es la de trabajo, la app cambia el selector.
   */
  delegationId: Id.optional(),
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

// ── Familias: mis datos (plan 12) ───────────────────────────────────────────

export const DETAIL_SECTIONS = [
  'identity',
  'contact',
  'address',
  'photo',
  'mcm',
  'health',
  'consents',
] as const;
export type DetailSection = (typeof DETAIL_SECTIONS)[number];
const DetailOptions = z.array(
  z.object({ value: z.string(), label: z.string() }),
);
const Text = z.string().nullable();

/**
 * `GET /v1/profiles/:pid/details`: los datos de quien se ve (uno mismo o un hijo), SIN la salud (va aparte, `/health`). Las secciones las
 * decide el servidor con la audiencia: `member`, las siete; `child` y `guardian`, sin `mcm`. NUNCA se guarda en el móvil. `null` es «sin
 * indicar»; en los consentimientos, «sin contestar» (nunca se convierte en «no»).
 */
export const PersonDetails = read({
  sections: z.array(z.enum(DETAIL_SECTIONS)),
  /** Solo lectura (salvo `identityFill`, para quien paga y no tiene el dato). */
  identity: z.object({
    firstName: z.string(),
    lastName: z.string(),
    documentType: Text,
    documentNumber: Text,
    birthDate: Day.nullable(),
  }),
  gender: Text,
  documentSupportNumber: Text,
  documentIssueDate: Day.nullable(),
  emailNote: z.enum(['mcm_email_warning', 'mcm_email_soft']).nullable(),
  contact: z.object({ email: Text, mobile: Text, emergencyPhone: Text }),
  address: z.object({
    street: Text,
    city: Text,
    province: Text,
    postalCode: Text,
    region: Text,
  }),
  photoUrl: PhotoUrl.nullable(),
  mcm: z
    .object({
      stage: Text,
      comLevel: Text,
      shirtSize: Text,
      groupName: Text,
      localMcm: Text,
      scarf: Scarf.nullable(),
      lcIncorporationYear: z.number().int().nullable(),
      memberSince: z.number().int().nullable(),
    })
    .nullable(),
  consents: z.object({
    dataProtection: z.boolean().nullable(),
    healthData: z.boolean().nullable(),
    photos: z.boolean().nullable(),
  }),
  options: z.object({
    gender: DetailOptions,
    documentType: DetailOptions,
    stage: DetailOptions,
    comLevel: DetailOptions,
    shirtSize: DetailOptions,
    localMcm: DetailOptions,
    region: DetailOptions,
  }),
});
export type PersonDetails = z.infer<typeof PersonDetails>;

/**
 * `PATCH /v1/profiles/:pid/details`: solo lo que cambia, ESTRICTO. Los consentimientos solo admiten `true` o `false` y solo se escribe el
 * que llega. `identityFill` solo escribe lo que en el CRM está vacío (quien paga y le falta el dato).
 */
export const PersonDetailsChanges = z.strictObject({
  gender: Text.optional(),
  documentSupportNumber: Text.optional(),
  documentIssueDate: Day.nullable().optional(),
  contact: z
    .strictObject({
      email: Text.optional(),
      mobile: Text.optional(),
      emergencyPhone: Text.optional(),
    })
    .optional(),
  address: z
    .strictObject({
      street: Text.optional(),
      city: Text.optional(),
      province: Text.optional(),
      postalCode: Text.optional(),
      region: Text.optional(),
    })
    .optional(),
  mcm: z
    .strictObject({
      stage: Text.optional(),
      comLevel: Text.optional(),
      shirtSize: Text.optional(),
      groupName: Text.optional(),
      localMcm: Text.optional(),
      scarf: SetScarf.nullable().optional(),
      lcIncorporationYear: z.number().int().nullable().optional(),
      memberSince: z.number().int().nullable().optional(),
    })
    .optional(),
  consents: z
    .strictObject({
      dataProtection: z.boolean().optional(),
      healthData: z.boolean().optional(),
      photos: z.boolean().optional(),
    })
    .optional(),
  identityFill: z
    .strictObject({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      documentType: z.string().optional(),
      documentNumber: z.string().optional(),
    })
    .optional(),
});
export type PersonDetailsChanges = z.infer<typeof PersonDetailsChanges>;
export const PersonDetailsWrite = z.strictObject({
  clientId: ClientId,
  changes: PersonDetailsChanges,
});
export type PersonDetailsWrite = z.infer<typeof PersonDetailsWrite>;
export const DetailsWriteResult = WriteResult.extend({
  details: PersonDetails,
});
export type DetailsWriteResult = z.infer<typeof DetailsWriteResult>;

/** La salud de quien se ve: solo por `/health`, sin caché, NUNCA en el móvil ni en el diario. */
export const HealthInfo = z.object({
  foodIntolerances: Text,
  allergies: Text,
  illnesses: Text,
  treatments: Text,
  other: Text,
});
export type HealthInfo = z.infer<typeof HealthInfo>;
export const ProfileHealth = read({ health: HealthInfo });
export type ProfileHealth = z.infer<typeof ProfileHealth>;
export const HealthWrite = z.strictObject({
  clientId: ClientId,
  health: z.strictObject({
    foodIntolerances: Text.optional(),
    allergies: Text.optional(),
    illnesses: Text.optional(),
    treatments: Text.optional(),
    other: Text.optional(),
  }),
});
export type HealthWrite = z.infer<typeof HealthWrite>;

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
   * Tiene relación de monitor, pero no cuelga de ningún grupo de Pasar Lista
   * de la delegación. Tres casos (plugin, 24-25/10/2026):
   *   · `none`: sin grupo de verdad (vacío o el comodín «POR DEFINIR»). Es lo
   *     que hay que arreglar: «Vincular» (`membershipId` es la relación). Solo
   *     lo ve quien coordina toda la delegación.
   *   · `support`: de un grupo de Apoyo (no pasa lista). Lo ven todas las
   *     coordinaciones, con su ficha a mano.
   *   · `outside`: de otro grupo que no pasa lista (Najar, Ruah…). No hay nada
   *     que arreglar; solo quien coordina toda la delegación, plegado.
   * `outsideGroupName`: el nombre de ese grupo (`support` y `outside`).
   */
  unassigned: z
    .object({
      membershipId: Id,
      kind: z.enum(['none', 'support', 'outside']),
      outsideGroupName: z.string().optional(),
    })
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
  /**
   * No se le pasa lista de grupo (Apoyo, otros grupos, sin grupo; solo en la
   * semanal): arranca SIN MARCAR, el toque cicla «-» → vino → no vino → «-»,
   * sin marca no se escribe ni cuenta, y no lleva % ni aviso (plugin,
   * 25/10/2026). En las reuniones se espera a todos: nunca es opcional.
   */
  optional: z.boolean(),
  /**
   * Solo en una reunión: de fuera del alcance de quien coordina (la reunión es
   * de toda la delegación). Se marca, pero sin ficha ni aviso ni %.
   */
  outOfScope: z.boolean().optional(),
  /**
   * `null` = sin asistencia todavía: se pinta y se guarda como «vino», salvo
   * en una fila `optional`, que se queda sin marcar.
   */
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

/**
 * `PUT /v1/sessions/:id/monitors-roll` — TODAS las filas, ninguna `null`,
 * salvo las `optional` sin marcar, que no van (sin marca no se escribe).
 */
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

// ── Pasar lista en un evento (plan 07 «Datos») ──────────────────────────────

/**
 * Un evento de la delegación que se puede pasar (`sticpa_pl_ev_clasificar`):
 * del curso, con fecha de inicio, de 50 días o menos, sin el de sesiones
 * semanales ni el de reuniones. La app lo clasifica con la fecha de hoy.
 */
export const EventSummary = z.object({
  id: Id,
  name: z.string(),
  /** Días en Madrid; sin fin, el de inicio. */
  startDate: Day,
  endDate: Day,
  startsAt: Instant,
  endsAt: Instant,
});
export type EventSummary = z.infer<typeof EventSummary>;

/** `GET /v1/events` — los de hoy, próximos y pasados del curso (la app clasifica). */
export const EventsResponse = read({
  season: z.string(),
  events: z.array(EventSummary),
});
export type EventsResponse = z.infer<typeof EventsResponse>;

/** Una marca de un evento: nunca `null` (sin marcar = no está). */
export const MarkEntry = z.object({
  mark: SetMark,
  reason: z.string().max(NOTE_MAX).optional(),
});
export type MarkEntry = z.infer<typeof MarkEntry>;

export const EVENT_ROLES = ['participant', 'monitor', 'team'] as const;
export const EventRole = z.enum(EVENT_ROLES);
export type EventRole = z.infer<typeof EventRole>;

export const NOT_GOING_STATUSES = [
  'cancelled',
  'rejected',
  'not_invited',
  'did_not_take_part',
] as const;
export const NotGoingStatus = z.enum(NOT_GOING_STATUSES);
export type NotGoingStatus = z.infer<typeof NotGoingStatus>;

/** Una persona de la lista del evento (`sticpa_pl_ev_lista`). */
export const EventPerson = z.object({
  person: PersonSummary,
  /** Curso: el de la inscripción o el de su relación de participante. */
  schoolLevel: SchoolLevel.nullable(),
  role: EventRole,
  /** Del curso; si no, la del grupo; si no, la de la ficha. */
  stage: z.enum(['mic', 'com', 'lc']).nullable(),
  /** Su grupo de los sábados en la delegación (abre su ficha). */
  homeGroup: z.object({ id: Id, code: z.string().nullable() }).nullable(),
  /** `null` = de la delegación del evento. */
  otherDelegation: Delegation.nullable(),
  activityGroupIds: z.array(Id),
  /** Solo en `notGoing`. */
  registrationStatus: NotGoingStatus.optional(),
});
export type EventPerson = z.infer<typeof EventPerson>;

export const ACTIVITY_TYPES = [
  'patrol',
  'dynamics',
  'room',
  'olympics',
  'cleaning',
  'subgroup',
  'clan',
  'house',
  'large_group',
  'other',
] as const;
export const ActivityType = z.enum(ACTIVITY_TYPES);
export type ActivityType = z.infer<typeof ActivityType>;

/** Una pestaña: un tipo y, si la hay, su tanda («Mitades»). */
export const ActivityTab = z.object({
  key: z.string(),
  type: ActivityType,
  batch: z.string().nullable(),
  groupCount: z.number().int().nonnegative(),
});
export type ActivityTab = z.infer<typeof ActivityTab>;

export const ActivityGroup = z.object({
  id: Id,
  tabKey: z.string(),
  name: z.string(),
  type: ActivityType,
  /** Plazas (las habitaciones). */
  capacity: z.number().int().positive().nullable(),
  /** «Con monitor»: sus monitores van arriba como «Monitor/a». */
  withMonitors: z.boolean(),
});
export type ActivityGroup = z.infer<typeof ActivityGroup>;

/**
 * Un miembro de un grupo. `personId` nulo o fuera de `people` (un monitor que
 * no se inscribió): se enseña con su `name` y no se marca.
 */
export const ActivityMember = z.object({
  groupId: Id,
  tabKey: z.string(),
  role: z.enum(['monitor', 'participant']),
  personId: Id.nullable(),
  name: z.string(),
});
export type ActivityMember = z.infer<typeof ActivityMember>;

/**
 * `GET /v1/events/:id/roll` — TODO lo que hace falta sin cobertura en una sola
 * consulta: el evento, sus días, las marcas de cada día, quién va, quién no y
 * los grupos de actividad (solo lectura).
 */
export const EventRoll = read({
  event: EventSummary,
  /** `kind: 'event'`; `[]` = el evento no tiene días en el CRM. */
  sessions: z.array(SessionSummary),
  marksBySession: z.record(Id, z.record(Id, MarkEntry)),
  people: z.array(EventPerson),
  notGoing: z.array(EventPerson),
  activity: z.object({
    tabs: z.array(ActivityTab),
    groups: z.array(ActivityGroup),
    members: z.array(ActivityMember),
  }),
});
export type EventRoll = z.infer<typeof EventRoll>;

/**
 * `PUT /v1/events/:id/roll` — las marcas puestas de esa lista (nunca `null`).
 * Con `sessionId: null`, el servidor busca la sesión de `day` y, si no hay, la
 * crea. Lo no enviado no se toca.
 */
export const EventRollWrite = z.object({
  clientId: ClientId,
  sessionId: Id.nullable(),
  day: Day,
  marks: z.record(Id, MarkEntry),
});
export type EventRollWrite = z.infer<typeof EventRollWrite>;
export const EventRollWriteResult = WriteResult.extend({
  sessionId: Id,
  counts: z.object({
    came: z.number().int().nonnegative(),
    missed: z.number().int().nonnegative(),
  }),
  /** Gente que no es de `people`: no se escribe, sin error. */
  skipped: z.array(Id),
});
export type EventRollWriteResult = z.infer<typeof EventRollWriteResult>;

// ── Avisos en el móvil (plan 08 «Datos») ────────────────────────────────────

/**
 * Los canales de Android que crea ESTE bundle para los avisos del área
 * (`constants/notificationChannels.ts`, `source: 'comunica'`). El móvil los
 * declara al registrarse y el servidor manda con ellos, nunca con uno escrito
 * a mano: un canal que la app no declara, Android lo tira sin decir nada.
 */
export const COMUNICA_CHANNEL_IDS = {
  rollCall: 'comunica-listas',
  groups: 'comunica-grupos',
} as const;

/** `POST /v1/devices` — alta o cambio del móvil; idempotente por `deviceId`. */
export const DeviceRegistration = z.object({
  clientId: ClientId,
  /** UUID v4 del móvil, guardado con la sesión (se borra al salir). */
  deviceId: z.uuid(),
  /** El token de Expo, del MISMO proyecto que usa el Panel. */
  pushToken: z.string().regex(/^Expo(nent)?PushToken\[[^\]]+\]$/),
  platform: z.enum(['ios', 'android']),
  appVersion: z.string().min(1),
  channels: z.object({
    rollCall: z.literal(COMUNICA_CHANNEL_IDS.rollCall),
    groups: z.literal(COMUNICA_CHANNEL_IDS.groups),
  }),
  /** Con las dos en `false`, el servidor no manda nada a este móvil. */
  prefs: z.object({ rollCallDue: z.boolean(), groupChanges: z.boolean() }),
});
export type DeviceRegistration = z.infer<typeof DeviceRegistration>;

/** `DELETE /v1/devices/:deviceId` — 204, sin cuerpo. */
export const NoContent = z.union([z.null(), z.undefined()]);

export const COMUNICA_PUSH_TYPES = [
  'rollcall_due',
  'group_changed',
  'outbox_pending',
] as const;

/** Un id que viene en un aviso: corto y sin nada raro (si no, a la portada). */
const NoticeRef = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

/**
 * El `data` de cada aviso del área. SIN texto libre (ni nombres ni salud: la
 * pantalla bloqueada la ve cualquiera, y el texto pasa por Expo, Apple y
 * Google): solo el tipo y los ids a los que lleva. Nunca una ruta: la app
 * decide a dónde va (`utils/comunica/noticeRoutes.ts`).
 */
export const ComunicaPushData = z.object({
  source: z.literal('comunica'),
  v: z.literal(1),
  /** `comunica:<uuid>`: no choca con los ids del Panel. */
  id: z.string().regex(/^comunica:[0-9a-f-]{36}$/i),
  type: z.enum(COMUNICA_PUSH_TYPES),
  groupId: NoticeRef.optional(),
  sessionId: NoticeRef.optional(),
});
export type ComunicaPushData = z.infer<typeof ComunicaPushData>;

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

// ── Mis datos de monitor (plan 09 «Datos») ──────────────────────────────────

/** Las opciones de un desplegable que da el servidor (crecen cada año). */
const Options = z.array(z.object({ value: z.string(), label: z.string() }));
/** Premonitores I y II: no, en curso, finalizado. */
export const PreMonitorStatus = z.enum(['no', 'in_progress', 'finished']);
/** MAT, DAT y FA: no, en curso, prácticas, pendiente título, titulado. */
export const CourseStatus = z.enum([
  'no',
  'in_progress',
  'internship',
  'pending_certificate',
  'certified',
]);
/** «Monitor/a de…»: una etapa (con Apoyo) u «Otros». */
export const MonitorOf = z.enum([...STAGES, 'other']);
export const SexOffenceMode = z.enum(['automatic', 'manual']);
export const DocumentKind = z.enum([
  'sex_offence_certificate',
  'mat',
  'dat',
  'other_training',
]);
export type DocumentKind = z.infer<typeof DocumentKind>;

export const MONITOR_SHORT_TEXT_MAX = 255;
export const MONITOR_LONG_TEXT_MAX = 4000;
const shortText = z.string().max(MONITOR_SHORT_TEXT_MAX).nullable();
const longText = z.string().max(MONITOR_LONG_TEXT_MAX).nullable();

/** Lo que el monitor puede cambiar. `null` = sin indicar (no es un «no»). */
export const MonitorProfileEditable = z.object({
  /** Solo el año (el CRM guarda `AAAA-01-01`). */
  monitorSince: z.number().int().min(1000).max(9999).nullable(),
  monitorOf: MonitorOf.nullable(),
  preMonitors1: PreMonitorStatus.nullable(),
  preMonitors2: PreMonitorStatus.nullable(),
  /** Texto libre en el CRM, aunque se pida como año. */
  preMonitorsYear: shortText,
  mat: CourseStatus.nullable(),
  /** Una clave de `options.matCourses`. */
  matCourse: z.string().nullable(),
  dat: CourseStatus.nullable(),
  fa: CourseStatus.nullable(),
  datYearAndSchool: shortText,
  faYearAndSchool: shortText,
  foodHandling: z.boolean().nullable(),
  /** Claves de `options.congresses`. */
  congresses: z.array(z.string()),
  academicBackground: longText,
  volunteeringDescription: longText,
  volunteeringPrograms: longText,
  sexOffenceCertificateMode: SexOffenceMode.nullable(),
});
export type MonitorProfileEditable = z.infer<typeof MonitorProfileEditable>;

/** «Archivo subido» de cada título: solo lectura, lo pone el servidor. */
export const MonitorFiles = z.object({
  sexOffenceCertificate: z.boolean(),
  mat: z.boolean(),
  dat: z.boolean(),
  otherTraining: z.boolean(),
});

/**
 * `GET /v1/me/monitor` — los datos de monitor de quien ha entrado. Solo con
 * papel `monitor` (si no, `forbidden`). Se guarda: son suyos y sin salud.
 */
export const MonitorProfile = read({
  ...MonitorProfileEditable.shape,
  files: MonitorFiles,
  options: z.object({ matCourses: Options, congresses: Options }),
});
export type MonitorProfile = z.infer<typeof MonitorProfile>;

/**
 * `PATCH /v1/me/monitor` — SOLO lo que cambia, y estricto: una clave de más
 * (`files`, un nombre del CRM) es `validation`.
 */
export const MonitorProfileWrite = z
  .object({
    clientId: ClientId,
    changes: MonitorProfileEditable.partial().strict(),
  })
  .strict();
export type MonitorProfileWrite = z.infer<typeof MonitorProfileWrite>;

/**
 * `POST /v1/me/documents` (multipart): estos dos campos y `file` (PDF, JPG o
 * PNG de hasta 4 MB). Motivos de `validation`: `empty_file`, `file_too_big`,
 * `bad_file_type`. Crea el Documento con su categoría, lo ata a la persona y
 * pone su «archivo subido».
 */
export const DocumentUploadFields = z.object({
  clientId: ClientId,
  kind: DocumentKind,
});
export type DocumentUploadFields = z.infer<typeof DocumentUploadFields>;

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
  appAccount: {
    method: 'POST',
    path: '/v1/auth/app-account',
    response: VerifyResponse,
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
  // Pasar lista en un evento (plan 07).
  events: {
    method: 'GET',
    path: '/v1/events',
    response: EventsResponse,
    persist: true,
  },
  eventRoll: {
    method: 'GET',
    path: '/v1/events/:id/roll',
    response: EventRoll,
    // Es lo que se usa sin cobertura (la puerta del autobús).
    persist: true,
  },
  saveEventRoll: {
    method: 'PUT',
    path: '/v1/events/:id/roll',
    response: EventRollWriteResult,
    persist: false,
  },
  // Avisos en el móvil (plan 08).
  registerDevice: {
    method: 'POST',
    path: '/v1/devices',
    response: WriteResult,
    persist: false,
  },
  unregisterDevice: {
    method: 'DELETE',
    path: '/v1/devices/:deviceId',
    response: NoContent,
    persist: false,
  },
  // Familias (plan 11): a quién se ve. Son nombres de los propios hijos y nada sensible.
  myProfiles: {
    method: 'GET',
    path: '/v1/me/profiles',
    response: MyProfiles,
    persist: true,
  },
  // Familias (plan 12): los datos de quien se ve. Son datos personales y de salud: NUNCA en el móvil.
  profileDetails: {
    method: 'GET',
    path: '/v1/profiles/:pid/details',
    response: PersonDetails,
    persist: false,
  },
  updateProfileDetails: {
    method: 'PATCH',
    path: '/v1/profiles/:pid/details',
    response: DetailsWriteResult,
    persist: false,
  },
  profileHealth: {
    method: 'GET',
    path: '/v1/profiles/:pid/health',
    response: ProfileHealth,
    persist: false,
  },
  updateProfileHealth: {
    method: 'PUT',
    path: '/v1/profiles/:pid/health',
    response: WriteResult,
    persist: false,
  },
  // Familias (plan 13): eventos de un perfil. Sin datos personales (el estado de su inscripción y poco más): se guardan para abrir rápido.
  profileActivities: {
    method: 'GET',
    path: '/v1/profiles/:pid/events',
    response: ActivityList,
    persist: true,
  },
  profileEvent: {
    method: 'GET',
    path: '/v1/profiles/:pid/events/:eventId',
    response: EventDetail,
    persist: true,
  },
  profileEventBySlug: {
    method: 'GET',
    path: '/v1/profiles/:pid/events/by-slug/:slug',
    response: EventDetail,
    persist: true,
  },
  // Familias (plan 14): inscripciones. La lista se guarda (títulos, fechas y estados); la ficha y el alta, NO (teléfonos de tutores, importes).
  profileRegistrations: {
    method: 'GET',
    path: '/v1/profiles/:pid/registrations',
    response: RegistrationsList,
    persist: true,
  },
  profileRegistration: {
    method: 'GET',
    path: '/v1/profiles/:pid/registrations/:rid',
    response: RegistrationDetail,
    persist: false,
  },
  profileSignupForm: {
    method: 'GET',
    path: '/v1/profiles/:pid/events/:eventId/signup',
    response: SignupForm,
    persist: false,
  },
  profileSignUp: {
    method: 'POST',
    path: '/v1/profiles/:pid/registrations',
    response: SignupResult,
    persist: false,
  },
  updateRegistration: {
    method: 'PATCH',
    path: '/v1/profiles/:pid/registrations/:rid',
    response: WriteResult,
    persist: false,
  },
  cancelRegistration: {
    method: 'POST',
    path: '/v1/profiles/:pid/registrations/:rid/cancel',
    response: WriteResult,
    persist: false,
  },
  advancedForm: {
    method: 'POST',
    path: '/v1/profiles/:pid/events/:eventId/advanced-form',
    response: AdvancedFormResult,
    persist: false,
  },
  // Familias (plan 15): pagos. NADA se guarda en el móvil (importes, conceptos, cuenta enmascarada, correo del pagador).
  profilePayments: {
    method: 'GET',
    path: '/v1/profiles/:pid/payments',
    response: PaymentsList,
    persist: false,
  },
  profilePayment: {
    method: 'GET',
    path: '/v1/profiles/:pid/payments/:id',
    response: PaymentDetail,
    persist: false,
  },
  cardCheckout: {
    method: 'GET',
    path: '/v1/profiles/:pid/card-checkout',
    response: CardCheckout,
    persist: false,
  },
  createCardAttempt: {
    method: 'POST',
    path: '/v1/profiles/:pid/card-attempts',
    // `simulated` SOLO lo devuelve el servidor falso; el cliente de verdad parsea con `CardAttempt` a secas (client.ts).
    response: z.union([CardAttempt, SimulatedAttempt]),
    persist: false,
  },
  checkCardAttempt: {
    method: 'POST',
    path: '/v1/profiles/:pid/card-attempts/:id/check',
    response: CardAttemptStatus,
    persist: false,
  },
  // Familias (plan 16): documentos (NADA al móvil) y calendario (sí). Subir, editar y borrar, directo y con conexión.
  profileDocuments: {
    method: 'GET',
    path: '/v1/profiles/:pid/documents',
    response: DocumentsResponse,
    persist: false,
  },
  profileDocument: {
    method: 'GET',
    path: '/v1/profiles/:pid/documents/:id',
    response: DocumentResponse,
    persist: false,
  },
  createProfileDocument: {
    method: 'POST',
    path: '/v1/profiles/:pid/documents',
    response: WriteResult,
    persist: false,
  },
  updateProfileDocument: {
    method: 'PATCH',
    path: '/v1/profiles/:pid/documents/:id',
    response: WriteResult,
    persist: false,
  },
  deleteProfileDocument: {
    method: 'DELETE',
    path: '/v1/profiles/:pid/documents/:id',
    response: WriteResult,
    persist: false,
  },
  profileCalendar: {
    method: 'GET',
    path: '/v1/profiles/:pid/calendar',
    response: CalendarData,
    persist: true,
  },
  profileSession: {
    method: 'GET',
    path: '/v1/profiles/:pid/sessions/:id',
    response: SessionResponse,
    persist: true,
  },
  // Mis datos de monitor (plan 09).
  myMonitor: {
    method: 'GET',
    path: '/v1/me/monitor',
    response: MonitorProfile,
    persist: true,
  },
  updateMyMonitor: {
    method: 'PATCH',
    path: '/v1/me/monitor',
    response: WriteResult,
    persist: false,
  },
  uploadMyDocument: {
    method: 'POST',
    path: '/v1/me/documents',
    response: WriteResult,
    persist: false,
  },
} as const;
export type RouteName = keyof typeof ROUTES;

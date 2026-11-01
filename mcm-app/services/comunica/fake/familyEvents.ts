// services/comunica/fake/familyEvents.ts
//
// Eventos de familias en el servidor falso (plan 13 «Servidor falso»):
// `GET /v1/profiles/:pid/events`, la ficha por id y por slug y los archivos
// del evento. Va aparte de `index.ts` (como `profiles.ts`) y se porta como el
// middleware (`comunicaMiddleware/src/app/profile-events.ts`):
//
//   · `pid` permitido o 403 (nunca 404), en CADA petición.
//   · `signedUp` = con inscripción no cancelada, SIN audiencia y SIN ocultar.
//     `toSignUp` = el resto, quitando los ocultos y los que no son para `pid`.
//     Lo pasado sale igual: lo quita la app con la fecha de hoy.
//   · Audiencia (ámbito, perfil y curso a la vez) con las dudas a favor de
//     enseñar, mirada con el PERFIL QUE SE VE, no con quien ha entrado.
//   · La ficha se sirve aunque no sea para ti (con el motivo); un archivo,
//     solo si es de ese evento y el evento es para ti o tienes plaza.
//   · Plazas y precio a 0 salen `null`: un 0 no es un dato.
//
// Todo inventado y relativo a hoy (el mando «la fecha de hoy» del plan 07 lo
// mueve), para que no caduque.

import {
  ActivityList,
  type BodyBlock,
  type EventCard,
  EventDetail,
  type ImageRef,
  type RouteName,
} from '../contract';
import {
  ComunicaApiError,
  type ComunicaApi,
  type PhotoSource,
} from '../client';
import type { FakeData } from './fixtures';
import { addDays } from '@/utils/comunica/madrid';

export interface FamilyEventsCtx {
  data: () => FakeData;
  gate: (route: RouteName) => Promise<void>;
  /** `sticpa_allowed_profile` (de `profiles.ts`). */
  allowedProfile: (pid: string) => boolean;
  today: () => string;
  nowIso: () => string;
  /** Una imagen abstracta y estable por clave (la de las fotos del falso). */
  image: (key: string) => string;
}

export type FamilyEventKeys =
  'getActivities' | 'getActivity' | 'getActivityBySlug' | 'eventFileSource';

export interface FamilyEventsFake {
  /**
   * El archivo tal y como lo serviría `…/documents/:documentId` (para los
   * tests y para `eventFileSource`): con permiso, o `not_found`.
   */
  eventDocument(
    pid: string,
    eventId: string,
    documentId: string,
  ): { mimeType: string; uri: string; fileName: string };
}

const D1 = 'f-del-villaclara';
const D2 = 'f-del-puertoalto';

const forbidden = () =>
  new ComunicaApiError('forbidden', 'No tienes acceso a esto', 403);
const notFound = () =>
  new ComunicaApiError(
    'not_found',
    'Esta actividad ya no está disponible.',
    404,
  );

// ── Quién mira (los perfiles del falso) ─────────────────────────────────────

interface Viewer {
  delegation: string;
  roles: string[];
  courses: string[];
}

/** Los papeles y cursos de cada persona de familias (`viewerOf`). */
const VIEWERS: Record<string, Omit<Viewer, 'delegation'>> = {
  'f-fam-rosa': { roles: ['familiar_menor'], courses: [] },
  'f-fam-lucia': { roles: ['participante_mic_com'], courses: ['1eso'] },
  'f-fam-sin-nombre': { roles: ['participante_mic_com'], courses: ['4ep'] },
  'f-fam-andres': { roles: ['familiar_menor'], courses: [] },
  'f-fam-pablo': { roles: ['participante_mic_com'], courses: ['5ep'] },
  'f-fam-teresa': { roles: ['familiar_menor'], courses: [] },
  'f-fam-carmen': {
    roles: ['monitor', 'grupo', 'familiar_menor'],
    courses: [],
  },
  'f-fam-ines': { roles: ['participante_mic_com'], courses: ['3ep'] },
  'f-fam-elena': { roles: ['grupo'], courses: [] },
  'f-fam-nuevo': { roles: ['participante_mic_com'], courses: ['1ep'] },
};

// ── Los eventos ─────────────────────────────────────────────────────────────

interface FakeActivity {
  id: string;
  name: string;
  /** Días desde hoy (`null` = sin fecha). */
  start: number | null;
  end: number | null;
  place: string | null;
  address: string | null;
  timetable?: string;
  /** Plazo, en días desde hoy. */
  opens: number | null;
  closes: number | null;
  status: string | null;
  advanced?: boolean;
  hidden?: boolean;
  delegation: string;
  scope?: 'local' | 'nacional';
  profiles?: string[];
  courses?: string[];
  capacity?: number;
  price?: number;
  mapUrl?: string;
  description?: string;
  tagline?: string;
  slug?: string;
  published?: boolean;
  cover?: string;
  body?: BodyBlock[];
  gallery?: string[];
  /** Documentos del evento: id → título y tipo. */
  docs?: Record<string, { title: string; kind: 'image' | 'pdf' }>;
}

const evId = (n: number) =>
  `ac7e0000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const docId = (n: number) =>
  `d0c00000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const regId = (n: number) =>
  `5e9e0000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Los ids que necesitan los tests. */
export const FAMILY_EVENT_IDS = {
  convivencia: evId(1),
  sinCuerpo: evId(2),
  avanzado: evId(3),
  sesionesMic: evId(4),
  otraDelegacion: evId(5),
  monitores: evId(6),
  otroCurso: evId(7),
  noAbre: evId(8),
  cerrada: evId(9),
  acabaHoy: evId(10),
  pasada: evId(11),
  ocultaConPlaza: evId(12),
  ocultaSinPlaza: evId(13),
  ceros: evId(14),
  rechazada: evId(15),
  docs: {
    cover: docId(1),
    image: docId(2),
    galleryA: docId(3),
    galleryB: docId(4),
    authorization: docId(5),
    materials: docId(6),
    /** Un PDF de OTRO evento (el de sesiones MIC). */
    otherEvent: docId(7),
  },
  slug: 'convivencia-otono-com',
};
const ID = FAMILY_EVENT_IDS;

const text = (v: string) => ({ t: 'text' as const, v });

/** El cuerpo de muestra: todos los tipos de bloque. */
const SAMPLE_BODY: BodyBlock[] = [
  { type: 'heading', level: 1, text: [text('Qué vamos a hacer')] },
  {
    type: 'paragraph',
    text: [
      text('Un fin de semana de '),
      { t: 'bold', c: [text('juegos, oración y montaña')] },
      text(' con todo el grupo del COM. '),
      {
        t: 'italic',
        c: [text('Salimos el sábado a las 9:00 desde el colegio.')],
      },
      { t: 'break' },
      text('Si tienes dudas, llama al '),
      {
        t: 'link',
        href: { url: 'tel:+34600111222' },
        c: [text('600 111 222')],
      },
      text(' o escribe a '),
      {
        t: 'link',
        href: { url: 'mailto:comunica@ejemplo.org' },
        c: [text('comunica@ejemplo.org')],
      },
      text('. Más fotos en '),
      {
        t: 'link',
        href: { url: 'https://www.ejemplo.org/albergue' },
        c: [text('la web del albergue')],
      },
      text('.'),
    ],
  },
  {
    type: 'notice',
    text: [
      text('Trae saco de dormir, linterna y la '),
      { t: 'bold', c: [text('tarjeta sanitaria')] },
      text('.'),
    ],
  },
  { type: 'heading', level: 2, text: [text('El programa')] },
  {
    type: 'list',
    ordered: true,
    start: 1,
    items: [
      [text('Sábado: llegada, juego de pistas y velada')],
      [text('Domingo: ruta y eucaristía')],
    ],
    children: {
      '1': {
        ordered: false,
        items: [[text('Ruta corta (5 km)')], [text('Comida en el refugio')]],
      },
    },
  },
  { type: 'heading', level: 2, text: [text('Qué llevar')] },
  {
    type: 'list',
    ordered: false,
    start: 1,
    items: [
      [text('Ropa de abrigo')],
      [text('Botas de montaña')],
      [text('Cantimplora')],
    ],
    children: {},
  },
  {
    type: 'button',
    label: 'Formulario de autorización',
    href: { url: 'https://comunica.movimientoconsolacion.com/autorizacion/' },
  },
  {
    type: 'image',
    src: { documentId: docId(2) },
    caption: 'El albergue, desde el camino',
    alt: 'Un albergue de piedra entre pinos',
  },
  {
    type: 'gallery',
    images: [{ documentId: docId(3) }, { documentId: docId(4) }],
  },
  {
    type: 'video',
    provider: 'youtube',
    id: 'M7lc1UVf-VE',
    url: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
  },
  {
    type: 'video',
    provider: 'vimeo',
    id: '76979871',
    url: 'https://vimeo.com/76979871',
  },
  { type: 'divider' },
  {
    type: 'paragraph',
    text: [
      text('La autorización está también en '),
      {
        t: 'link',
        href: { documentId: docId(5) },
        c: [text('este PDF')],
      },
      text('. Un enlace raro no se pinta como enlace: '),
      { t: 'link', href: { url: 'javascript:alert(1)' }, c: [text('este')] },
      text('.'),
    ],
  },
];

function activities(): FakeActivity[] {
  const local = { delegation: D1, scope: 'local' as const };
  return [
    {
      id: ID.convivencia,
      name: 'Convivencia de otoño COM',
      start: 9,
      end: 10,
      place: 'Albergue Los Pinos',
      address: 'Camino del Pinar, 4, Villaclara',
      timetable: 'Sábado de 9:00 a domingo a las 18:00',
      opens: -10,
      closes: 5,
      status: 'Inscripciones abiertas',
      ...local,
      profiles: ['participante_mic_com'],
      courses: ['1eso', '2eso', '3eso', '4eso'],
      capacity: 40,
      price: 35,
      tagline: 'Dos días para conocernos de verdad',
      slug: ID.slug,
      published: true,
      cover: ID.docs.cover,
      body: SAMPLE_BODY,
      gallery: [ID.docs.galleryA],
      docs: {
        [ID.docs.cover]: { title: 'Cartel', kind: 'image' },
        [ID.docs.image]: { title: 'El albergue', kind: 'image' },
        [ID.docs.galleryA]: { title: 'Foto 1', kind: 'image' },
        [ID.docs.galleryB]: { title: 'Foto 2', kind: 'image' },
        [ID.docs.authorization]: {
          title: 'Autorización de salida',
          kind: 'pdf',
        },
        [ID.docs.materials]: { title: 'Lista de material', kind: 'pdf' },
      },
    },
    {
      id: ID.sinCuerpo,
      name: 'Excursión al Moncayo',
      start: 23,
      end: null,
      place: null,
      address: 'Parking del Santuario, Moncayo',
      opens: null,
      closes: null,
      status: null,
      ...local,
      price: 12.5,
      description:
        'Salida de un día para toda la familia.\nVolvemos a media tarde.\n\nTrae comida y agua.',
    },
    {
      id: ID.avanzado,
      name: 'Campamento de verano',
      start: 55,
      end: 64,
      place: 'Campamento El Robledal',
      address: null,
      mapUrl: 'https://maps.app.goo.gl/robledal',
      opens: -3,
      closes: 40,
      status: 'Inscripciones abiertas',
      advanced: true,
      ...local,
      capacity: 120,
      price: 260,
      description:
        'Diez días de campamento. La inscripción va por el formulario de la actividad.',
    },
    {
      id: ID.sesionesMic,
      name: 'Sesiones semanales MIC',
      start: -30,
      end: 200,
      place: 'Colegio Consolación',
      address: null,
      timetable: 'Sábados de 17:30 a 19:00',
      opens: null,
      closes: null,
      status: 'Inscripciones abiertas',
      ...local,
      profiles: ['participante_mic_com'],
      courses: ['4ep', '5ep', '6ep'],
      description:
        'Las sesiones de los sábados para 4.º, 5.º y 6.º de Primaria.',
      docs: { [ID.docs.otherEvent]: { title: 'Calendario', kind: 'pdf' } },
    },
    {
      id: ID.otraDelegacion,
      name: 'Encuentro de Puerto Alto',
      start: 15,
      end: 15,
      place: 'Parroquia del Puerto',
      address: null,
      opens: -5,
      closes: 10,
      status: null,
      delegation: D2,
      scope: 'local',
      description: 'Para las familias de Puerto Alto.',
    },
    {
      id: ID.monitores,
      name: 'Encuentro de monitores',
      start: 12,
      end: 13,
      place: 'Casa de espiritualidad',
      address: null,
      opens: null,
      closes: 8,
      status: null,
      ...local,
      profiles: ['monitor'],
      description: 'Formación y convivencia del equipo.',
    },
    {
      id: ID.otroCurso,
      name: 'Taller de 2.º de ESO',
      start: 20,
      end: null,
      place: 'Colegio Consolación',
      address: null,
      opens: null,
      closes: 18,
      status: null,
      ...local,
      profiles: ['participante_mic_com'],
      courses: ['2eso'],
      description: 'Solo para 2.º de ESO.',
    },
    {
      id: ID.noAbre,
      name: 'Retiro de Adviento',
      start: 35,
      end: 36,
      place: 'Monasterio de Santa Clara',
      address: null,
      opens: 7,
      closes: 25,
      status: 'Inscripciones abiertas',
      ...local,
      description: 'Un fin de semana de silencio y oración.',
    },
    {
      id: ID.cerrada,
      name: 'Concierto solidario',
      start: 4,
      end: null,
      place: 'Auditorio municipal',
      address: null,
      opens: -20,
      closes: -2,
      status: 'Inscripciones abiertas',
      ...local,
      price: 5,
      description: 'Entradas agotadas.',
    },
    {
      id: ID.acabaHoy,
      name: 'Jornadas de puertas abiertas',
      start: -2,
      end: 0,
      place: 'Colegio Consolación',
      address: null,
      opens: null,
      closes: null,
      status: null,
      ...local,
      description: 'Hoy es el último día.',
    },
    {
      id: ID.pasada,
      name: 'Fiesta de inicio de curso',
      start: -20,
      end: -20,
      place: 'Patio del colegio',
      address: null,
      opens: -40,
      closes: -22,
      status: null,
      ...local,
      description: 'Ya pasó.',
    },
    {
      id: ID.ocultaConPlaza,
      name: 'Salida de los delegados',
      start: 18,
      end: 18,
      place: 'Zaragoza',
      address: null,
      opens: null,
      closes: 14,
      status: null,
      hidden: true,
      ...local,
      description: 'Oculta en el área, pero Lucía ya tiene plaza.',
    },
    {
      id: ID.ocultaSinPlaza,
      name: 'Reunión de preparación (oculta)',
      start: 6,
      end: null,
      place: 'Sala de reuniones',
      address: null,
      opens: null,
      closes: null,
      status: null,
      hidden: true,
      ...local,
      description: 'Solo se llega con el enlace.',
    },
    {
      id: ID.ceros,
      name: 'Cine fórum',
      start: 3,
      end: null,
      place: 'Salón de actos',
      address: null,
      opens: null,
      closes: 2,
      status: null,
      ...local,
      capacity: 0,
      price: 0,
      description: 'Plazas y precio a 0 en el CRM: no se pintan.',
    },
    {
      id: ID.rechazada,
      name: 'Pascua joven',
      start: 150,
      end: 153,
      place: 'Monasterio de Poblet',
      address: null,
      opens: -2,
      closes: 120,
      status: 'Inscripciones abiertas',
      ...local,
      description: 'Lucía tiene la inscripción rechazada.',
    },
  ];
}

/** Las inscripciones no canceladas de cada perfil (evento → inscripción). */
const REGISTRATIONS: Record<
  string,
  { eventId: string; id: string; status: 'confirmed' | 'rejected' }[]
> = {
  'f-fam-lucia': [
    { eventId: ID.ocultaConPlaza, id: regId(1), status: 'confirmed' },
    { eventId: ID.rechazada, id: regId(2), status: 'rejected' },
    { eventId: ID.pasada, id: regId(3), status: 'confirmed' },
  ],
  'f-fam-sin-nombre': [
    { eventId: ID.sesionesMic, id: regId(4), status: 'confirmed' },
  ],
  'f-fam-pablo': [
    { eventId: ID.sesionesMic, id: regId(5), status: 'confirmed' },
  ],
};

const PDF_BASE64 =
  'JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgMzAwIDIwMF0vQ29udGVudHMgNCAwIFIvUmVzb3VyY2VzPDwvRm9udDw8L0YxIDUgMCBSPj4+Pj4+ZW5kb2JqCjQgMCBvYmo8PC9MZW5ndGggNTI+PnN0cmVhbQpCVCAvRjEgMTggVGYgMzAgMTAwIFRkIChEb2N1bWVudG8gZGUgcHJ1ZWJhKSBUaiBFVAplbmRzdHJlYW0gZW5kb2JqCjUgMCBvYmo8PC9UeXBlL0ZvbnQvU3VidHlwZS9UeXBlMS9CYXNlRm9udC9IZWx2ZXRpY2E+PmVuZG9iagp0cmFpbGVyPDwvUm9vdCAxIDAgUj4+CiUlRU9G';

// ── Audiencia (`matchAudience` del middleware) ──────────────────────────────

const PROFILE_MAP: Record<string, string[]> = {
  coordinacion: ['coordinacion_mic_com', 'acompanamiento_mic_com'],
};
const PROFILE_LABELS: Record<string, string> = {
  grupo: 'miembros del MCM con grupo',
  monitor: 'monitores y monitoras',
  participante_mic_com: 'participantes de MIC y COM',
  coordinacion: 'equipo de coordinación',
  familiar_menor: 'familias',
};

type Reason = 'delegation' | 'profile' | 'course';

function matchAudience(a: FakeActivity, v: Viewer): Reason | null {
  if (
    (a.scope ?? 'local') === 'local' &&
    a.delegation &&
    v.delegation &&
    a.delegation !== v.delegation
  ) {
    return 'delegation';
  }
  if (a.profiles?.length) {
    const accepted = a.profiles.flatMap((p) => PROFILE_MAP[p] ?? [p]);
    if (!accepted.some((x) => v.roles.includes(x))) return 'profile';
  }
  if (a.courses?.length && v.courses.length) {
    if (!a.courses.some((c) => v.courses.includes(c))) return 'course';
  }
  return null;
}

function audienceMessage(reason: Reason, a: FakeActivity): string {
  if (reason === 'delegation') {
    return 'Esta actividad la organiza otra delegación, así que la inscripción no está abierta para ti.';
  }
  if (reason === 'course')
    return 'Esta actividad es para otros cursos escolares.';
  const labels = (a.profiles ?? [])
    .map((p) => PROFILE_LABELS[p])
    .filter(Boolean);
  if (!labels.length) {
    return 'Esta actividad va dirigida a un perfil concreto y tu ficha no lo tiene.';
  }
  const joined =
    labels.length < 2
      ? labels[0]
      : `${labels.slice(0, -1).join(', ')} y ${labels.at(-1)}`;
  return `Esta actividad es solo para ${joined}.`;
}

// ── Las rutas ───────────────────────────────────────────────────────────────

export function familyEventRoutes(
  ctx: FamilyEventsCtx,
): Pick<ComunicaApi, FamilyEventKeys> & FamilyEventsFake {
  const requireProfile = (pid: string) => {
    if (!ctx.allowedProfile(pid)) throw forbidden();
  };

  const viewer = (pid: string): Viewer => {
    const person = ctx.data().people.find((p) => p.id === pid);
    const known = VIEWERS[pid] ?? { roles: ['monitor', 'grupo'], courses: [] };
    return { delegation: person?.delegationId ?? D1, ...known };
  };

  const day = (n: number | null) =>
    n === null ? null : addDays(ctx.today(), n);

  const mine = (pid: string) =>
    new Map((REGISTRATIONS[pid] ?? []).map((r) => [r.eventId, r]));

  const card = (a: FakeActivity, pid: string): EventCard => {
    const reg = mine(pid).get(a.id);
    return {
      id: a.id,
      name: a.name,
      startDate: day(a.start),
      endDate: day(a.end),
      place: a.place ?? a.address,
      statusLabel: a.status,
      window: { opensOn: day(a.opens), closesOn: day(a.closes) },
      hasAdvancedForm: !!a.advanced,
      myRegistrationId: reg?.id ?? null,
      myRegistrationStatus: reg
        ? reg.status === 'rejected'
          ? { label: 'Rechazada', tone: 'danger' }
          : { label: 'Con plaza', tone: 'ok' }
        : null,
    };
  };

  const ref = (id: string): ImageRef => ({ documentId: id });

  const detail = (a: FakeActivity, pid: string) => {
    const docs = a.docs ?? {};
    const attachments = Object.entries(docs)
      .filter(([, d]) => d.kind === 'pdf')
      .map(([documentId, d]) => ({ documentId, title: d.title }));
    const body = a.body ?? [];
    const gallery = (a.gallery ?? []).map(ref);
    const hasWeb =
      !!a.cover ||
      body.length > 0 ||
      attachments.length > 0 ||
      gallery.length > 0;
    const publicUrl = a.published
      ? `https://comunica.movimientoconsolacion.com/actividades/?e=${encodeURIComponent(a.slug ?? a.id)}`
      : null;
    const reason = matchAudience(a, viewer(pid));
    return EventDetail.parse({
      generatedAt: ctx.nowIso(),
      ...card(a, pid),
      tagline: hasWeb ? (a.tagline ?? null) : null,
      description: !hasWeb ? (a.description ?? null) : null,
      timetable: a.timetable ?? null,
      address: a.address,
      capacity: a.capacity && a.capacity > 0 ? a.capacity : null,
      price: a.price && a.price > 0 ? a.price : null,
      map: a.mapUrl
        ? { url: a.mapUrl }
        : a.address || a.place
          ? { query: (a.address ?? a.place)! }
          : null,
      cover: a.cover ? ref(a.cover) : null,
      body,
      gallery,
      attachments,
      publicUrl,
      share: publicUrl ? { url: publicUrl, kind: 'public' } : null,
      signup: {
        audience: reason
          ? { ok: false, reason, message: audienceMessage(reason, a) }
          : { ok: true },
      },
    });
  };

  const find = (id: string) => activities().find((a) => a.id === id);

  function eventDocument(pid: string, eventId: string, documentId: string) {
    requireProfile(pid);
    const a = find(eventId);
    const doc = a?.docs?.[documentId];
    if (!a || !doc) throw notFound();
    if (matchAudience(a, viewer(pid)) && !mine(pid).has(eventId)) {
      throw notFound();
    }
    return doc.kind === 'pdf'
      ? {
          mimeType: 'application/pdf',
          uri: `data:application/pdf;base64,${PDF_BASE64}`,
          fileName: `${doc.title}.pdf`,
        }
      : {
          mimeType: 'image/svg+xml',
          uri: ctx.image(documentId),
          fileName: `${doc.title}.svg`,
        };
  }

  return {
    eventDocument,

    async getActivities(pid) {
      await ctx.gate('profileEvents');
      requireProfile(pid);
      const regs = mine(pid);
      const v = viewer(pid);
      const toSignUp: EventCard[] = [];
      const signedUp: EventCard[] = [];
      for (const a of activities()) {
        if (regs.has(a.id)) signedUp.push(card(a, pid));
        else if (!a.hidden && matchAudience(a, v) === null) {
          toSignUp.push(card(a, pid));
        }
      }
      return ActivityList.parse({
        generatedAt: ctx.nowIso(),
        toSignUp,
        signedUp,
      });
    },

    async getActivity(pid, eventId) {
      await ctx.gate('profileEvent');
      requireProfile(pid);
      const a = find(eventId);
      if (!a) throw notFound();
      return detail(a, pid);
    },

    async getActivityBySlug(pid, slug) {
      await ctx.gate('profileEventBySlug');
      requireProfile(pid);
      const a = activities().find((x) => x.slug === slug || x.id === slug);
      if (!a) throw notFound();
      return detail(a, pid);
    },

    eventFileSource(pid, eventId, documentId): PhotoSource {
      // Sin permiso, una URL que no carga (como el 404 del de verdad).
      try {
        const doc = eventDocument(pid, eventId, documentId);
        return { uri: doc.uri, cacheKey: `evdoc:${documentId}` };
      } catch {
        return { uri: 'data:,', cacheKey: `evdoc:${documentId}:x` };
      }
    },
  };
}

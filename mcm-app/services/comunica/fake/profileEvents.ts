// services/comunica/fake/profileEvents.ts
//
// «Eventos y su ficha» en el servidor falso (plan 13, familias). Va aparte de `index.ts` y comparte con él el estado a través de `ctx`. Se porta como el
// servidor de verdad (`comunicaMiddleware:src/app/profile-events.ts`):
//
//   · Todas las rutas empiezan por `allowedProfile` (plan 11): `pid` es quien ha entrado o uno de sus hijos; si no, 403.
//   · Listado: `signedUp` = los que el perfil tiene con inscripción no cancelada (SIN audiencia y SIN ocultos); `toSignUp` = el resto, sin los ocultos
//     en el área privada y sin los que no son para ese perfil. Los pasados los quita la app con la fecha de hoy.
//   · Ficha: se sirve aunque no sea para ti (con el motivo en `signup.audience`), por id o por slug; lo inexistente es `not_found`.
//   · Un `0` de plazas o de precio no sale (`null`): un 0 no es un dato.
//   · Los días son relativos a «hoy» del falso (`ctx.today()`), así que las pruebas con el mando del reloj son estables.
//
// Datos de prueba: la delegación de Villaclara (la de la familia) y una delegación B.

import {
  ActivityList,
  EventDetail,
  type BodyBlock,
  type EventCard,
  type ImageRef,
  type RouteName,
} from '../contract';
import { ComunicaApiError, type ComunicaApi } from '../client';
import type { FakeData, PersonaId } from './fixtures';
import { allowedProfile } from './profiles';
import { activeRegistration } from './registrations';
import { addDays } from '@/utils/comunica/madrid';

export interface EventsCtx {
  data: () => FakeData;
  gate: (route: RouteName, write?: boolean) => Promise<void>;
  persona: () => PersonaId;
  roles: () => readonly string[];
  today: () => string;
  nowIso: () => string;
  controls: () => { profilesDown: boolean; newChildNext: boolean };
}

export type ProfileEventKeys =
  | 'getProfileActivities'
  | 'getProfileEvent'
  | 'getProfileEventBySlug'
  | 'eventFileSource';
type EventsApi = Pick<ComunicaApi, ProfileEventKeys>;

const notFound = () =>
  new ComunicaApiError('not_found', 'No existe', 404, 'event_not_found');

export interface FakeEvent {
  id: string;
  name: string;
  /** Días desde «hoy». */
  start: number | null;
  end: number | null;
  place: string | null;
  address?: string | null;
  statusLabel: string | null;
  opens: number | null;
  closes: number | null;
  advancedForm?: boolean;
  hidden?: boolean;
  tagline?: string | null;
  description?: string | null;
  timetable?: string | null;
  capacity?: number;
  price?: number;
  published?: string;
  cover?: ImageRef;
  body?: BodyBlock[];
  gallery?: ImageRef[];
  attachments?: { documentId: string; title: string }[];
  /** Quién no puede apuntarse y por qué (el texto es el del plugin). */
  audience?: { reason: 'delegation' | 'profile' | 'course'; message: string };
  /** Solo para monitores (se mira el papel de quien ve). */
  onlyMonitors?: boolean;
  /** Solo para quien NO es Lucía (otro curso). */
  notFor?: string[];
  map?: { url: string } | { query: string };
  /** Las preguntas del alta corta (2 como mucho). */
  questions?: { n: 1 | 2; prompt: string | null; options: string[] }[];
  /** Medios de pago que ofrece el CRM para este evento (con precio). */
  methods?: ('direct_debit' | 'card')[];
}

const t = (v: string): { t: 'text'; v: string } => ({ t: 'text', v });

/** El cuerpo con TODOS los tipos de bloque (y un enlace de cada tipo). */
const FULL_BODY: BodyBlock[] = [
  { type: 'heading', level: 1, text: [t('Qué vamos a hacer')] },
  {
    type: 'paragraph',
    text: [
      t('Un fin de semana para convivir, rezar y jugar. '),
      { t: 'bold', c: [t('Trae saco de dormir')] },
      t(' y '),
      { t: 'italic', c: [t('ganas de pasarlo bien')] },
      t('. Dudas: '),
      {
        t: 'link',
        href: { url: 'mailto:comunica@movimientoconsolacion.com' },
        c: [t('comunica@movimientoconsolacion.com')],
      },
      { t: 'break' },
      t('o al '),
      { t: 'link', href: { url: 'tel:+34600111222' }, c: [t('600 111 222')] },
      t('.'),
    ],
  },
  {
    type: 'notice',
    text: [t('Las plazas son limitadas: se asignan por orden de inscripción.')],
  },
  { type: 'heading', level: 2, text: [t('Qué llevar')] },
  {
    type: 'list',
    ordered: false,
    start: 1,
    items: [[t('Saco y esterilla')], [t('Ropa de abrigo')], [t('Linterna')]],
    children: {
      1: { ordered: false, items: [[t('Mejor de cabeza')], [t('Con pilas')]] },
    },
  },
  {
    type: 'list',
    ordered: true,
    start: 1,
    items: [[t('Llegada y acogida')], [t('Talleres')], [t('Eucaristía')]],
    children: {},
  },
  { type: 'divider' },
  {
    type: 'image',
    src: { documentId: 'doc-foto-1' },
    caption: 'El año pasado',
    alt: 'Grupo en el patio',
  },
  {
    type: 'gallery',
    images: [{ documentId: 'doc-foto-2' }, { documentId: 'doc-foto-3' }],
  },
  {
    type: 'video',
    provider: 'youtube',
    id: 'dQw4w9WgXcQ',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  },
  {
    type: 'video',
    provider: 'vimeo',
    id: '76979871',
    url: 'https://vimeo.com/76979871',
  },
  {
    type: 'button',
    label: 'Autorización de salida',
    href: { documentId: 'doc-autorizacion' },
  },
  {
    type: 'button',
    label: 'Más información',
    href: {
      url: 'https://comunica.movimientoconsolacion.com/actividades/?e=convivencia-com',
    },
  },
  {
    type: 'button',
    label: 'Página del albergue',
    href: { url: 'https://example.org/albergue' },
  },
];

export const EVENTS: FakeEvent[] = [
  {
    id: 'pev-convi',
    name: 'Convivencia COM',
    start: 30,
    end: 32,
    place: 'Casa de colonias El Pinar',
    address: 'Camino del Pinar 12, Benicàssim',
    statusLabel: 'Inscripciones abiertas',
    opens: -10,
    closes: 20,
    tagline: 'Un fin de semana para convivir',
    timetable: 'Sábado 10:00 a domingo 18:00',
    capacity: 60,
    price: 45,
    published: 'convivencia-com',
    questions: [
      { n: 1, prompt: '¿Vas a dormir en el albergue?', options: ['Sí', 'No'] },
      { n: 2, prompt: null, options: ['Autobús', 'Coche propio', 'Otro'] },
    ],
    methods: ['direct_debit', 'card'],
    cover: { documentId: 'doc-cartel' },
    body: FULL_BODY,
    gallery: [{ documentId: 'doc-foto-2' }, { documentId: 'doc-foto-3' }],
    attachments: [
      { documentId: 'doc-autorizacion', title: 'Autorización de salida' },
    ],
    map: { query: 'Camino del Pinar 12, Benicàssim' },
  },
  {
    id: 'pev-sinc',
    name: 'Merienda de bienvenida',
    start: 10,
    end: 10,
    place: 'Salón parroquial',
    statusLabel: 'Inscripciones abiertas',
    opens: null,
    closes: null,
    description:
      'Primera merienda del curso.\nTraed algo para compartir.\n\nOs esperamos.',
    capacity: 0,
    price: 0,
  },
  {
    id: 'pev-fwa',
    name: 'Campamento de verano',
    start: 60,
    end: 70,
    place: 'Sierra de Gredos',
    statusLabel: 'Inscripciones abiertas',
    opens: -5,
    closes: 40,
    advancedForm: true,
    price: 180,
    capacity: 40,
    description: 'Diez días en la sierra.',
    map: { url: 'https://maps.example.org/gredos' },
  },
  {
    id: 'pev-sesiones',
    name: 'Sesiones semanales MIC 4.º-6.º EP',
    start: 3,
    end: 3,
    place: 'Parroquia',
    statusLabel: 'Inscripciones abiertas',
    opens: null,
    closes: null,
    description: 'Cada sábado.',
  },
  {
    id: 'pev-otra-del',
    name: 'Encuentro de Burriana',
    start: 20,
    end: 20,
    place: 'Burriana',
    statusLabel: 'Inscripciones abiertas',
    opens: -3,
    closes: 15,
    audience: {
      reason: 'delegation',
      message: 'Esta actividad es solo para la delegación de Burriana.',
    },
  },
  {
    id: 'pev-monitores',
    name: 'Formación de monitores',
    start: 25,
    end: 25,
    place: 'Casa diocesana',
    statusLabel: 'Inscripciones abiertas',
    opens: -3,
    closes: 18,
    onlyMonitors: true,
    audience: {
      reason: 'profile',
      message: 'Esta actividad es solo para monitores y monitoras.',
    },
  },
  {
    id: 'pev-otro-curso',
    name: 'Excursión de 5.º de Primaria',
    start: 22,
    end: 22,
    place: 'Parque natural',
    statusLabel: 'Inscripciones abiertas',
    opens: -3,
    closes: 14,
    notFor: ['f-hijo-lucia'],
    audience: {
      reason: 'course',
      message: 'Esta actividad es para otro curso.',
    },
  },
  {
    id: 'pev-no-abre',
    name: 'Pascua joven',
    start: 90,
    end: 93,
    place: 'Teruel',
    statusLabel: 'Inscripciones abiertas',
    opens: 5,
    closes: 60,
  },
  {
    id: 'pev-cerrada',
    name: 'Jornada de puertas abiertas',
    start: 12,
    end: 12,
    place: 'Colegio',
    statusLabel: 'Inscripciones abiertas',
    opens: -20,
    closes: -1,
  },
  {
    id: 'pev-acaba-hoy',
    name: 'Triduo de hoy',
    start: -2,
    end: 0,
    place: 'Parroquia',
    statusLabel: 'Inscripciones abiertas',
    opens: -30,
    closes: -10,
  },
  {
    id: 'pev-pasada',
    name: 'Día de la familia',
    start: -9,
    end: -8,
    place: 'Polideportivo',
    statusLabel: 'Realizada',
    opens: -40,
    closes: -20,
  },
  {
    id: 'pev-oculta-con',
    name: 'Retiro de confirmación',
    start: 15,
    end: 15,
    place: 'Convento',
    statusLabel: null,
    opens: -5,
    closes: 10,
    hidden: true,
  },
  {
    id: 'pev-oculta-sin',
    name: 'Reunión reservada',
    start: 16,
    end: 16,
    place: 'Salón',
    statusLabel: null,
    opens: -5,
    closes: 10,
    hidden: true,
  },
  {
    id: 'pev-curso',
    name: 'Curso de Catequesis MIC',
    start: -60,
    end: 120,
    place: 'Parroquia',
    statusLabel: 'Realizándose',
    opens: -90,
    closes: 30,
  },
  {
    id: 'pev-rechazada',
    name: 'Ruta de senderismo',
    start: 18,
    end: 18,
    place: 'Penyagolosa',
    statusLabel: 'Inscripciones abiertas',
    opens: -5,
    closes: 12,
  },
];

/** ¿Es el evento para ese perfil? (la audiencia del falso: delegación, papel y curso). */
export function eventIsFor(
  roles: readonly string[],
  pid: string,
  self: boolean,
  e: FakeEvent,
): boolean {
  if (e.onlyMonitors && !(self && roles.includes('monitor'))) return false;
  if (e.notFor?.includes(pid)) return false;
  // Lo que es de otra delegación o de «otro curso» tampoco es para nadie de la familia de prueba.
  if (e.audience && !e.onlyMonitors && !e.notFor) return false;
  return true;
}

export function profileEventsRoutes(ctx: EventsCtx): EventsApi {
  const day = (offset: number | null) =>
    offset == null ? null : addDays(ctx.today(), offset);

  const profileOk = (pid: string, self: boolean, e: FakeEvent) =>
    eventIsFor(ctx.roles(), pid, self, e);
  const audienceOf = (pid: string, self: boolean, e: FakeEvent) =>
    profileOk(pid, self, e)
      ? ({ ok: true } as const)
      : ({ ok: false, ...e.audience! } as const);

  const cardOf = (pid: string, e: FakeEvent): EventCard => {
    const reg = activeRegistration(ctx.data(), pid, e.id);
    return {
      id: e.id,
      name: e.name,
      startDate: day(e.start),
      endDate: day(e.end),
      place: e.place ?? e.address ?? null,
      statusLabel: e.statusLabel,
      window: { opensOn: day(e.opens), closesOn: day(e.closes) },
      hasAdvancedForm: !!e.advancedForm,
      myRegistrationId: reg?.id ?? null,
      myRegistrationStatus: reg ? { ...reg.status } : null,
    };
  };

  const detailOf = (pid: string, self: boolean, e: FakeEvent) => {
    const hasWeb = !!e.body?.length;
    return EventDetail.parse({
      generatedAt: ctx.nowIso(),
      ...cardOf(pid, e),
      tagline: hasWeb ? (e.tagline ?? null) : null,
      description: hasWeb ? null : (e.description ?? null),
      timetable: e.timetable ?? null,
      address: e.address ?? null,
      // Un 0 no es un dato.
      capacity: e.capacity && e.capacity > 0 ? e.capacity : null,
      price: e.price && e.price > 0 ? e.price : null,
      map:
        e.map ??
        (e.address || e.place ? { query: e.address ?? e.place } : null),
      cover: e.cover ?? null,
      body: e.body ?? [],
      gallery: e.gallery ?? [],
      attachments: e.attachments ?? [],
      publicUrl: e.published
        ? `https://comunica.movimientoconsolacion.com/actividades/?e=${e.published}`
        : null,
      share: e.published
        ? {
            url: `https://comunica.movimientoconsolacion.com/actividades/?e=${e.published}`,
            kind: 'public',
          }
        : {
            url: `https://comunica.movimientoconsolacion.com/?internalpage=single_stic_events&action=detail&id=${e.id}`,
            kind: 'area',
          },
      signup: { audience: audienceOf(pid, self, e) },
    });
  };

  return {
    async getProfileActivities(pid) {
      await ctx.gate('profileActivities');
      const who = allowedProfile(ctx as never, pid);
      const has = (e: FakeEvent) =>
        !!activeRegistration(ctx.data(), who.id, e.id);
      const signedUp = EVENTS.filter(has);
      const toSignUp = EVENTS.filter(
        (e) => !has(e) && !e.hidden && profileOk(who.id, who.self, e),
      );
      return ActivityList.parse({
        generatedAt: ctx.nowIso(),
        toSignUp: toSignUp.map((e) => cardOf(who.id, e)),
        signedUp: signedUp.map((e) => cardOf(who.id, e)),
      });
    },

    async getProfileEvent(pid, eventId) {
      await ctx.gate('profileEvent');
      const who = allowedProfile(ctx as never, pid);
      const e = EVENTS.find((x) => x.id === eventId);
      if (!e) throw notFound();
      return detailOf(who.id, who.self, e);
    },

    async getProfileEventBySlug(pid, slug) {
      await ctx.gate('profileEventBySlug');
      const who = allowedProfile(ctx as never, pid);
      const e = EVENTS.find((x) => x.published === slug || x.id === slug);
      if (!e) throw notFound();
      return detailOf(who.id, who.self, e);
    },

    eventFileSource(pid, eventId, documentId) {
      // Una imagen abstracta, estable por documento (el falso no sirve archivos de verdad).
      const hue =
        [...documentId].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) %
        360;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><rect width="300" height="400" fill="hsl(${hue} 55% 60%)"/><circle cx="150" cy="170" r="90" fill="hsl(${(hue + 140) % 360} 60% 78%)"/></svg>`;
      return {
        uri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
        cacheKey: `${pid}/${eventId}/${documentId}`,
      };
    },
  };
}

// utils/eventRoutes.ts
// Traduce los NOMBRES de pantalla de los stacks de «Más» y de evento
// (`'Horario'`, `'Fotos'`, `'JubileoHome'`…) a rutas de expo-router.
//
// Con expo-router 58 cada pantalla es un fichero de ruta (el estado de
// navegación se crea a partir de ellos; ya no se montan navegadores a mano).
// Los nombres se conservan como API porque es lo que usan el resto de piezas
// (`masNavigation`, `eventNavigation`, `tabNavigation`, las tarjetas de «Más»);
// aquí, y solo aquí, se sabe a qué ruta corresponde cada uno.
//
//   · «Más»            → /mas, /mas/fotos, /mas/horario…
//   · Visita del Papa  → /visitapapa (hub), /visitapapa/horario…
//
// Los parámetros de ruta viajan por URL: son TEXTO. Nada de objetos.

/** Raíz de las rutas de cada stack que contiene pantallas de evento. */
export const MAS_BASE = '/mas';
export const VISITAPAPA_BASE = '/visitapapa';
export type EventBase = typeof MAS_BASE | typeof VISITAPAPA_BASE;

/** Pantallas de evento → trozo de ruta. */
export const EVENT_SLUGS = {
  Horario: 'horario',
  Materiales: 'materiales',
  MaterialPages: 'material',
  Visitas: 'visitas',
  Profundiza: 'profundiza',
  Grupos: 'grupos',
  Contactos: 'contactos',
  Apps: 'apps',
  Reflexiones: 'reflexiones',
  Evaluacion: 'evaluacion',
  Comida: 'comida',
  ComidaWeb: 'comida-web',
  Wordle: 'wordle',
} as const;

export type EventScreenName = keyof typeof EVENT_SLUGS;

/** Pantallas propias de «Más». `JubileoHome` es el hub de un evento apilado. */
export const MAS_ONLY_SLUGS = {
  MasHome: '',
  Fotos: 'fotos',
  Calendario: 'calendario',
  Comunica: 'comunica',
  ComunicaGestion: 'comunica-gestion',
  McmPanel: 'mcm-panel',
  EventosPasados: 'eventos-pasados',
  JubileoHome: 'evento',
} as const;

export type MasOnlyScreenName = keyof typeof MAS_ONLY_SLUGS;
export type MasScreenName = MasOnlyScreenName | EventScreenName;
export type EventAnyScreenName = EventScreenName | 'JubileoHome';

/** Params de ruta: solo texto. Se descartan `undefined`/`null`. */
export type RouteParams = Record<string, string | number | boolean | undefined>;

export function toRouteParams(
  params?: Record<string, unknown>,
): Record<string, string> | undefined {
  if (!params) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'object') continue; // los objetos no viajan por URL
    out[key] = String(value);
  }
  return Object.keys(out).length ? out : undefined;
}

export interface ScreenHref {
  pathname: string;
  params?: Record<string, string>;
}

const join = (base: string, slug: string) => (slug ? `${base}/${slug}` : base);

/** Ruta de una pantalla del stack de «Más». */
export function masHref(
  screen: MasScreenName,
  params?: Record<string, unknown>,
): ScreenHref {
  const slug =
    screen in MAS_ONLY_SLUGS
      ? MAS_ONLY_SLUGS[screen as MasOnlyScreenName]
      : EVENT_SLUGS[screen as EventScreenName];
  const query = toRouteParams(params);
  return { pathname: join(MAS_BASE, slug), ...(query && { params: query }) };
}

/**
 * Ruta de una pantalla de evento dentro de `base`. En la pestaña propia del
 * evento (`/visitapapa`) el hub es la raíz; en «Más» es `/mas/evento`.
 */
export function eventHref(
  base: EventBase,
  screen: EventAnyScreenName,
  params?: Record<string, unknown>,
): ScreenHref {
  const query = toRouteParams(params);
  const pathname =
    screen === 'JubileoHome'
      ? base === MAS_BASE
        ? join(MAS_BASE, MAS_ONLY_SLUGS.JubileoHome)
        : base
      : join(base, EVENT_SLUGS[screen]);
  return { pathname, ...(query && { params: query }) };
}

/** Trozos de ruta de las sub-pantallas de evento (todo menos el hub). */
export const EVENT_SUB_SLUGS: readonly string[] = Object.values(EVENT_SLUGS);

/** Último trozo de una ruta (`/mas/horario?x=1` → `horario`). */
export function lastSegment(pathname: string): string {
  const clean = pathname.split(/[?#]/)[0].replace(/\/+$/, '');
  return clean.slice(clean.lastIndexOf('/') + 1);
}

// services/comunica/links.ts
//
// Qué hace la app con un enlace de Comunica (plan 10 §3-§4). PURO y sin
// imports de la app: lo usa `app/+native-intent.ts`, que corre antes de que
// arranque nada.
//
//   1. Un enlace con el token del correo nativo (`acceso_app`) → entrar.
//   2. Con token del plugin (`acceso_magico`, `token`) → en la nativa se
//      canjea por una sesión (`POST /v1/auth/exchange`); en el legado, la
//      WebView con el token, como siempre.
//   3. Con destino (`internalpage` y compañía) → la pantalla nativa si la
//      hay; si no, el legado en esa página con la sesión puesta.
//   4. La página pública de una actividad (`/actividades?e=<slug>`) → su ficha.
//   5. Cualquier otra página del dominio → el legado con esa URL tal cual.
//   6. Nada válido → la portada del área. Nunca se carga una URL que no
//      hayamos construido o validado.

export const COMUNICA_HOST = 'comunica.movimientoconsolacion.com';
export const COMUNICA_ORIGIN = `https://${COMUNICA_HOST}`;

/** El destino dentro del área privada, con las formas del plugin. */
export interface Destination {
  internalpage: string;
  action?: 'detail' | 'create' | 'edit';
  id?: string;
  from?: string;
}

/** `sticpa_login_destination_shapes()` de `inc/stic-magic-login.php`. */
export const DESTINATION_SHAPES: Record<
  Exclude<keyof Destination, 'internalpage'>,
  RegExp
> = {
  action: /^(detail|create|edit)$/,
  id: /^[a-f0-9-]{10,64}$/i,
  from: /^[a-z_]{1,32}$/,
};
const PAGE_SHAPE = /^[a-z0-9_]{1,64}$/;

/**
 * Las páginas internas del plugin (`pages/` de `comunicaAreaPrivada`) y el
 * plan de la app que las hace nativas. Lo que no tenga pantalla nativa aún va
 * al legado con el mismo destino.
 */
export const PLUGIN_PAGES = {
  single_stic_pasar_lista: '04',
  single_stic_pasar_lista_grupos: '04',
  single_stic_pasar_lista_marcar: '04',
  single_stic_mis_grupos: '05',
  single_stic_pasar_lista_ficha: '05',
  single_stic_coordinacion: '06',
  single_stic_pasar_lista_resumen: '06',
  single_stic_pasar_lista_monitores: '06',
  single_stic_pasar_lista_monitor: '06',
  single_stic_pasar_lista_reuniones: '06',
  single_stic_pasar_lista_evento: '07',
  single_stic_comunica_monitor: '09',
  single_stic_home: '11',
  single_stic_profile_selection: '11',
  single_stic_comunica_perfil: '12',
  single_stic_profile: '12',
  single_stic_comunica_laico: '12',
  single_stic_tutor_profile: '12',
  list_stic_events: '13',
  single_stic_events: '13',
  list_stic_registrations: '14',
  single_stic_registrations: '14',
  list_stic_payments: '15',
  single_stic_payments: '15',
  single_stic_payment_form: '15',
  single_stic_payment_error: '15',
  list_stic_payment_commitments: '15',
  single_stic_payment_commitments: '15',
  list_stic_documents: '16',
  single_stic_documents: '16',
  single_stic_activities_calendar: '16',
  single_stic_sessions: '16',
  list_stic_sessions: '16',
  list_stic_attendances: '16',
  // Desactivadas o sin sentido en nativo: a «Tu cuenta».
  single_stic_password_change: 'yo',
  single_stic_unsubscribe: 'yo',
  // El resto del plugin, siempre al legado.
  custom_html: 'legado',
} as const satisfies Record<string, string>;

/** Ruta de la app (expo-router) para un destino, si ya es nativo. */
export interface NativeHref {
  pathname: string;
  params?: Record<string, string>;
}

/**
 * Las pantallas nativas que existen HOY. Cada plan, al hacer las suyas, las
 * añade aquí; un test recorre `PLUGIN_PAGES` para que ninguna se quede sin
 * sitio.
 */
const NATIVE: Record<string, (d: Destination) => NativeHref | null> = {
  single_stic_pasar_lista: () => ({ pathname: '/comunica' }),
  single_stic_pasar_lista_grupos: () => ({
    pathname: '/comunica/pasar-lista/grupos',
  }),
  // El plugin lleva aquí el grupo y la sesión en parámetros propios que el
  // pase no conserva: se abre el árbol para elegir.
  single_stic_pasar_lista_marcar: () => ({
    pathname: '/comunica/pasar-lista/grupos',
  }),
  // Grupos y fichas (plan 05). La ficha lleva al chaval en `participante`,
  // que el destino no conserva: con un `id`, su ficha; si no, el índice.
  single_stic_mis_grupos: () => ({ pathname: '/comunica/grupos' }),
  single_stic_pasar_lista_ficha: (d) =>
    d.id
      ? {
          pathname: '/comunica/grupos/persona/[personId]',
          params: { personId: d.id },
        }
      : { pathname: '/comunica/grupos' },
  // Coordinación (plan 06). La ficha del monitor lleva al monitor en
  // `monitor`, que el destino no conserva: con un `id`, su ficha.
  single_stic_coordinacion: () => ({ pathname: '/comunica/coordinacion' }),
  single_stic_pasar_lista_resumen: () => ({
    pathname: '/comunica/coordinacion/resumen',
  }),
  single_stic_pasar_lista_monitores: () => ({
    pathname: '/comunica/coordinacion/monitores',
  }),
  single_stic_pasar_lista_reuniones: () => ({
    pathname: '/comunica/coordinacion/reuniones',
  }),
  single_stic_pasar_lista_monitor: (d) =>
    d.id
      ? {
          pathname: '/comunica/coordinacion/monitor/[id]',
          params: { id: d.id },
        }
      : { pathname: '/comunica/coordinacion' },
  single_stic_pasar_lista_evento: (d) =>
    d.id
      ? { pathname: '/comunica/eventos/[eventId]', params: { eventId: d.id } }
      : { pathname: '/comunica/eventos' },
  single_stic_password_change: () => ({ pathname: '/comunica/yo' }),
  single_stic_unsubscribe: () => ({ pathname: '/comunica/yo' }),
};

export function registerNativePage(
  page: string,
  fn: (d: Destination) => NativeHref | null,
): void {
  NATIVE[page] = fn;
}

export function nativeHrefFor(d: Destination): NativeHref | null {
  return NATIVE[d.internalpage]?.(d) ?? null;
}

/** El destino saneado, o `null` si no vale (misma regla que el plugin). */
export function parseDestination(
  params: Record<string, string | undefined>,
): Destination | null {
  const page = params.internalpage;
  if (!page || !PAGE_SHAPE.test(page)) return null;
  const d: Destination = { internalpage: page };
  for (const key of Object.keys(
    DESTINATION_SHAPES,
  ) as (keyof typeof DESTINATION_SHAPES)[]) {
    const v = params[key];
    if (typeof v === 'string' && DESTINATION_SHAPES[key].test(v)) {
      (d as unknown as Record<string, string>)[key] = v;
    }
  }
  return d;
}

/**
 * Query string → objeto, sin `URL`/`URLSearchParams` (el polyfill de React
 * Native va justo y esto corre antes de que arranque nada).
 */
export function parseQuery(url: string): Record<string, string> {
  const start = url.indexOf('?');
  if (start === -1) return {};
  const end = url.indexOf('#', start);
  const query = url.slice(start + 1, end === -1 ? undefined : end);
  const out: Record<string, string> = {};
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = eq === -1 ? pair : pair.slice(0, eq);
    const value = eq === -1 ? '' : pair.slice(eq + 1);
    try {
      out[decodeURIComponent(key)] = decodeURIComponent(
        value.replace(/\+/g, ' '),
      );
    } catch {
      out[key] = value;
    }
  }
  return out;
}

/** Tokens que pueden venir en un enlace (formas razonables, nada de espacios). */
const TOKEN_SHAPE = /^[A-Za-z0-9_\-.~=]{1,1024}$/;
const SLUG_SHAPE = /^[a-z0-9-]{1,128}$/;

export type ComunicaLink =
  | { kind: 'appAccess'; linkToken: string }
  | {
      kind: 'page';
      destination: Destination | null;
      auth: { magic?: string; token?: string } | null;
    }
  | { kind: 'event'; slug: string }
  | { kind: 'other'; url: string };

/** El camino (sin dominio ni query) de una URL de Comunica, o `null`. */
function comunicaPath(url: string): string | null {
  const noQuery = url.split(/[?#]/)[0];
  if (/^mcmapp:\/\/comunica\/?$/.test(noQuery)) return '/ap/';
  const m = /^https?:\/\/([^/]+)(\/.*)?$/i.exec(noQuery);
  if (m) {
    if (m[1].toLowerCase() !== COMUNICA_HOST) return null;
    return m[2] ?? '/';
  }
  // expo-router a veces entrega solo el camino: se acepta SOLO si es del área
  // o de las actividades (ninguna ruta de la app se llama así), para no
  // secuestrar los enlaces de la propia app.
  if (/^\/(ap|app|area-privada|actividades)(\/|$)/.test(noQuery))
    return noQuery;
  return null;
}

/** Los caminos que son el área privada (o su puente de acceso). */
const AREA_PATH = /^\/(ap|app|area-privada)(\/.*)?$/;

/** Clasifica un enlace. `null` = no es de Comunica. */
export function classifyComunicaLink(url: string): ComunicaLink | null {
  const path = comunicaPath(url);
  if (path === null) return null;
  const q = parseQuery(url);

  if (q.acceso_app && TOKEN_SHAPE.test(q.acceso_app)) {
    return { kind: 'appAccess', linkToken: q.acceso_app };
  }
  if (/^\/actividades\/?$/.test(path)) {
    return q.e && SLUG_SHAPE.test(q.e)
      ? { kind: 'event', slug: q.e }
      : { kind: 'other', url: `${COMUNICA_ORIGIN}/actividades/` };
  }
  const isArea = AREA_PATH.test(path) || (path === '/' && !!q.internalpage);
  if (!isArea) {
    // Otra página del dominio (formularios públicos, WordPress): tal cual,
    // pero reconstruida por nosotros y sin la query.
    const safe = /^\/[A-Za-z0-9/_\-.]*$/.test(path) ? path : '/';
    return { kind: 'other', url: `${COMUNICA_ORIGIN}${safe}` };
  }
  const magic =
    q.acceso_magico && TOKEN_SHAPE.test(q.acceso_magico)
      ? q.acceso_magico
      : undefined;
  const token = q.token && TOKEN_SHAPE.test(q.token) ? q.token : undefined;
  return {
    kind: 'page',
    destination: parseDestination(q),
    auth: magic || token ? { magic, token } : null,
  };
}

/**
 * La página PÚBLICA que abre el legado sin sesión para un enlace: la ficha de
 * una actividad (hasta que sea nativa, plan 13) u otra página del dominio, ya
 * reconstruida por `classifyComunicaLink`. `null` si no es de esas.
 */
export function publicPageUrl(link: ComunicaLink | null): string | null {
  if (link?.kind === 'event')
    return `${COMUNICA_ORIGIN}/actividades/?e=${link.slug}`;
  if (link?.kind === 'other') return link.url;
  return null;
}

/** La query de un destino, en el orden del plugin. */
export function destinationQuery(d: Destination): string {
  return (['internalpage', 'action', 'id', 'from'] as const)
    .filter((k) => d[k])
    .map((k) => `${k}=${encodeURIComponent(d[k] as string)}`)
    .join('&');
}

/** ¿Lo abre la propia página (true) o lo cogemos nosotros (false)? */
export function decideLegacyNavigation(url: string):
  | { allow: true }
  | {
      allow: false;
      native?: NativeHref | null;
      external?: string;
    } {
  if (/^(about:|data:|blob:)/.test(url)) return { allow: true };
  const link = classifyComunicaLink(url);
  if (!link) {
    // Fuera de Comunica: al navegador del sistema.
    return /^https?:\/\//i.test(url)
      ? { allow: false, external: url }
      : { allow: false };
  }
  if (link.kind === 'page' && link.destination && !link.auth) {
    const native = nativeHrefFor(link.destination);
    if (native) return { allow: false, native };
  }
  return { allow: true };
}

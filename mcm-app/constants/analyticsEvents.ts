// Catálogo de eventos de analítica.
//
// Es una lista CERRADA a propósito. La forma más rápida de que una analítica
// deje de servir para nada es que cada pantalla invente su propio nombre de
// evento: a los tres meses tienes cuarenta nombres parecidos y ningún dato
// comparable. Aquí el nombre y las propiedades de cada evento están tipados, y
// `trackEvent` solo acepta lo que esté declarado en este fichero.
//
// Reglas de la casa:
//   1. **Nombres en español y en `snake_case`**, en pasado o como sustantivo:
//      lo que se lee en el panel de Aptabase es esto tal cual.
//   2. **Nada que identifique a una persona.** Ni nombres, ni correos, ni ids
//      de usuario, ni texto que haya escrito nadie (búsquedas incluidas). Las
//      propiedades son categorías, no contenido.
//   3. **Poca cardinalidad.** Aptabase agrupa por valor: una propiedad con
//      miles de valores distintos (un título de canción, una ruta con id) no se
//      puede leer en un gráfico. Preferir la categoría al elemento concreto.
//   4. Si hace falta un evento nuevo, se añade AQUÍ primero.
//
// Aptabase no tiene "propiedades de usuario": el perfil y la delegación se
// añaden a cada evento desde `utils/analytics.ts` (ver `baseProps`).

import type { ProfileType } from '@/types/profileConfig';
import type { NotificationCategory } from '@/types/notifications';

/** Evento sin propiedades propias (igual lleva las comunes). */
export type SinPropiedades = Record<never, never>;

/** Mapa evento → propiedades. */
export interface AnalyticsEvents {
  /**
   * Arranque de la app. Sirve de denominador para todo lo demás: sin esto, un
   * "500 canciones abiertas" no dice si es mucho o poco.
   */
  app_abierta: SinPropiedades;

  /**
   * Navegación. Se dispara sola con cada cambio de ruta (ver
   * `hooks/useScreenTracking.ts`), así que NO hay que llamarla a mano.
   *
   * `ruta` va normalizada: los ids concretos se sustituyen por `:id` para no
   * disparar la cardinalidad (`/(tabs)/mas/jubileo` → `/(tabs)/mas/:id`).
   */
  pantalla_vista: { ruta: string };

  /** Se abre una canción del cantoral. */
  cancion_abierta: {
    /** Categoría del cantoral, NO el título (cardinalidad y ruido). */
    categoria: string;
    /** Desde dónde se llegó: lista, búsqueda o playlist. */
    origen: 'lista' | 'busqueda' | 'playlist';
  };

  /** Modo presentación (pantalla completa) de una canción. */
  modo_presentacion: SinPropiedades;

  /** Se crea o comparte una playlist de canciones seleccionadas. */
  playlist_usada: {
    accion: 'creada' | 'compartida' | 'importada';
    /** Número de canciones, en tramos, para que sea agrupable. */
    tamano: '1-5' | '6-15' | '16-30' | '30+';
  };

  /** El usuario toca una notificación y entra en la app. */
  notificacion_abierta: {
    categoria: NotificationCategory | 'sin_categoria';
  };

  /**
   * Se sale del onboarding. `via` distingue quién lo rellenó de quién le dio a
   * "saltar": es el dato que dice si el onboarding estorba o ayuda.
   */
  onboarding_completado: { via: 'completado' | 'saltado' };

  /** Se abre el hub de un evento (Jubileo, encuentros…). */
  evento_abierto: { evento: string };

  /** Se activa el modo Carismochito agitando el móvil. */
  carismochito_activado: SinPropiedades;
}

export type AnalyticsEventName = keyof AnalyticsEvents;

/** Propiedades comunes que se añaden a TODOS los eventos. */
export interface AnalyticsBaseProps {
  /** Perfil resuelto del usuario. Categoría, no identificador. */
  perfil: ProfileType | 'sin_perfil';
  /** Delegación. Igual: sirve para segmentar por zona, no para identificar. */
  delegacion: string;
}

/** Tramo de tamaño de una playlist, para no mandar el número exacto. */
export function tramoTamano(
  n: number,
): AnalyticsEvents['playlist_usada']['tamano'] {
  if (n <= 5) return '1-5';
  if (n <= 15) return '6-15';
  if (n <= 30) return '16-30';
  return '30+';
}

/**
 * Normaliza una ruta de expo-router para que sirva como propiedad de evento.
 *
 * Quita los parámetros de consulta y sustituye por `:id` todo segmento que
 * parezca un identificador concreto (números, uuids, slugs largos). Sin esto,
 * `pantalla_vista` tendría un valor distinto por cada canción y el gráfico no
 * se podría leer.
 */
export function normalizeRoute(pathname: string): string {
  if (!pathname) return '/';
  const withoutQuery = pathname.split('?')[0];
  const segments = withoutQuery.split('/').map((segment) => {
    if (!segment) return segment;
    // Grupos de expo-router: `(tabs)`, `(stack)`… se conservan tal cual.
    if (segment.startsWith('(') && segment.endsWith(')')) return segment;
    if (/^\d+$/.test(segment)) return ':id';
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(segment)) return ':id';
    // Segmentos largos o con codificación de URL: casi siempre un título.
    if (segment.length > 24 || segment.includes('%')) return ':id';
    return segment;
  });
  const route = segments.join('/');
  return route.length > 0 ? route : '/';
}

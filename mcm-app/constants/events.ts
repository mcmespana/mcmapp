/**
 * Registry de eventos (Jubileo, encuentros, retiros, etc.).
 *
 * ── Cómo añadir un evento nuevo ──
 * 1. Duplica JUBILEO más abajo y cámbiale `id`, `title`, `tintColor`,
 *    `firebasePrefix` y las `sections` que ofrezca el evento.
 * 2. Regístralo en `EVENTS` con su `id` como clave.
 * 3. Sube los datos a Firebase bajo `<firebasePrefix>/<section.firebaseKey>`.
 * 4. Navega a JubileoHome (el hub de eventos) pasando
 *    `{ eventId: '<id>' }` como route param desde donde quieras
 *    (por ejemplo, desde MasHome).
 *
 * No hace falta tocar ninguna sub-pantalla: todas leen el `eventId`
 * del route y calculan su path de Firebase desde este registry.
 */
import type { ComponentProps } from 'react';
import type { MaterialIcons } from '@expo/vector-icons';

export interface EventSection {
  label: string;
  subtitle?: string;
  emoji: string;
  materialIcon?: ComponentProps<typeof MaterialIcons>['name'];
  /** Nombre de la pantalla a la que navegar en MasStackParamList. */
  target: string;
  tintColor: string;
  /**
   * Slug de Firebase relativo al `firebasePrefix` del evento.
   * Ej.: 'horario' → path final `jubileo/horario`.
   * Si se omite, la sub-pantalla no intenta leer Firebase con el prefijo del evento.
   */
  firebaseKey?: string;
}

export interface EventConfig {
  /** Identificador único (también usado como prefijo de cache). */
  id: string;
  /** Título mostrado en el header del stack. */
  title: string;
  /** Color de acento del evento (header, accent bars del hub). */
  tintColor: string;
  /** Prefijo de Firebase Realtime Database para todas las secciones. */
  firebasePrefix: string;
  sections: EventSection[];
}

// ─── Eventos ─────────────────────────────────────────────────────────

export const JUBILEO: EventConfig = {
  id: 'jubileo',
  title: 'Jubileo',
  tintColor: '#A3BD31',
  firebasePrefix: 'jubileo',
  sections: [
    {
      label: 'Horario',
      subtitle: 'Programa del encuentro',
      emoji: '⏰',
      materialIcon: 'schedule',
      target: 'Horario',
      tintColor: '#FF8A65',
      firebaseKey: 'horario',
    },
    {
      label: 'Materiales',
      subtitle: 'Recursos y dinámicas',
      emoji: '📦',
      materialIcon: 'inventory-2',
      target: 'Materiales',
      tintColor: '#4FC3F7',
      firebaseKey: 'materiales',
    },
    {
      label: 'Comida',
      subtitle: 'Menú y turnos',
      emoji: '🍽️',
      materialIcon: 'restaurant',
      target: 'Comida',
      tintColor: '#F06292',
      firebaseKey: 'comida',
    },
    {
      label: 'Visitas',
      subtitle: 'Salidas y traslados',
      emoji: '🚌',
      materialIcon: 'directions-bus',
      target: 'Visitas',
      tintColor: '#81C784',
      firebaseKey: 'visitas',
    },
    {
      label: 'Profundiza',
      subtitle: 'Reflexión y textos',
      emoji: '📖',
      materialIcon: 'menu-book',
      target: 'Profundiza',
      tintColor: '#BA68C8',
      firebaseKey: 'profundiza',
    },
    {
      label: 'Grupos',
      subtitle: 'Equipos de trabajo',
      emoji: '👥',
      materialIcon: 'groups',
      target: 'Grupos',
      tintColor: '#FFD54F',
      firebaseKey: 'grupos',
    },
    {
      label: 'Contactos',
      subtitle: 'Teléfonos útiles',
      emoji: '☎️',
      materialIcon: 'contact-phone',
      target: 'Contactos',
      tintColor: '#9FA8DA',
      firebaseKey: 'contactos',
    },
    {
      label: 'Apps',
      subtitle: 'Herramientas MCM',
      emoji: '📲',
      materialIcon: 'apps',
      target: 'Apps',
      tintColor: '#FFB74D',
      firebaseKey: 'apps',
    },
  ],
};

// ─── Registry ────────────────────────────────────────────────────────

export const EVENTS: Record<string, EventConfig> = {
  [JUBILEO.id]: JUBILEO,
};

export const DEFAULT_EVENT_ID = JUBILEO.id;

/** Devuelve la config del evento. Cae a Jubileo si el id es inválido o nulo. */
export function getEvent(id?: string | null): EventConfig {
  if (!id) return EVENTS[DEFAULT_EVENT_ID];
  return EVENTS[id] ?? EVENTS[DEFAULT_EVENT_ID];
}

/** Path de Firebase de una sección: `<firebasePrefix>/<key>`. */
export function getEventFirebasePath(
  event: EventConfig,
  key: string,
): string {
  return `${event.firebasePrefix}/${key}`;
}

/** Clave de caché AsyncStorage de una sección: `<id>_<key>`. */
export function getEventCacheKey(event: EventConfig, key: string): string {
  return `${event.id}_${key}`;
}

/**
 * Registry de eventos (Jubileo, encuentros, retiros, etc.).
 *
 * Documentación completa: /docs/funcionalidades/EVENTOS.md en la raíz del monorepo.
 *
 * ── Resumen para añadir un evento nuevo ──
 * 1. Duplica JUBILEO más abajo y cámbiale `id`, `title`, `tintColor`,
 *    `firebasePrefix` y las `sections`.
 *    · Jubileo vive en `jubileo/` (raíz de Firebase).
 *    · Eventos creados desde el panel MCM viven en
 *      `activities/<nombreDelEvento>/`.
 * 2. Regístralo en `EVENTS` con su `id` como clave.
 * 3. Sube los datos a Firebase bajo `<firebasePrefix>/<section.firebaseKey>`
 *    (el panel MCM ya lo hace).
 * 4. Añade un ítem en `getAllNavigationItems` de `MasHomeScreen` con
 *    `target: 'JubileoHome'` y `eventId: '<id>'`.
 *
 * No hace falta tocar ninguna sub-pantalla: todas leen `eventId` del
 * route y resuelven su path de Firebase desde este registry.
 *
 * Secciones ocultas: cualquier sección con `hidden: true` en la config
 * local o con `hidden: true` en el nodo Firebase queda oculta en el hub.
 */
import type { ComponentProps } from 'react';
import type { ImageSourcePropType } from 'react-native';
import type { MaterialIcons } from '@expo/vector-icons';

export interface EventSection {
  label: string;
  subtitle?: string;
  emoji: string;
  materialIcon?: ComponentProps<typeof MaterialIcons>['name'];
  /**
   * Nombre de la pantalla a la que navegar en MasStackParamList. Opcional:
   * las secciones-enlace (`url`) no navegan a ninguna pantalla.
   */
  target?: string;
  /**
   * Enlace externo. Si está presente, la tarjeta abre la URL con
   * `Linking.openURL` en vez de navegar a `target` (ej. una lista de Google
   * Maps). Reutilizable para cualquier sección que sea solo un enlace.
   */
  url?: string;
  tintColor: string;
  /**
   * Slug de Firebase relativo al `firebasePrefix` del evento.
   * Ej.: 'horario' → path final `jubileo/horario` o
   * `activities/evento2027/horario`. Si se omite, la sub-pantalla no
   * intenta leer Firebase con el prefijo del evento.
   */
  firebaseKey?: string;
  /**
   * Oculta la sección en el hub del evento. Equivale al flag `hidden`
   * que el panel MCM puede poner en el nodo Firebase. Si falta, false.
   */
  hidden?: boolean;
}

export interface EventConfig {
  /** Identificador único (también usado como prefijo de cache). */
  id: string;
  /** Título mostrado en el header del stack. */
  title: string;
  /** Color de acento del evento (header, accent bars del hub). */
  tintColor: string;
  /**
   * Logo/emblema del evento que se muestra en el hero del hub. Si falta, el
   * hero usa el emblema-placeholder (icono `auto-awesome`).
   * Ej.: `require('@/assets/alzalamirada.png')`.
   */
  heroImage?: ImageSourcePropType;
  /**
   * Prefijo de Firebase Realtime Database para todas las secciones.
   * · Jubileo: `jubileo` (raíz).
   * · Eventos del panel MCM: `activities/<nombre>` (ej.
   *   `activities/evento2027`).
   */
  firebasePrefix: string;
  /**
   * Estado del evento:
   * · `active`   → evento destacado (modo evento): tab propia + botón Home +
   *   banner en la Home. Es el `ACTIVE_EVENT_ID`.
   * · `archived` → evento pasado: accesible en "Más > Eventos pasados".
   * Si falta, se trata como activo de cara al catálogo.
   */
  status?: 'active' | 'archived';
  /** Subtítulo del banner destacado de la Home (modo evento). */
  bannerText?: string;
  /**
   * Categorías de la pantalla de Grupos que se ocultan en este evento
   * (ej. `['Alojamiento']`). La comparación ignora mayúsculas y acentos.
   * Si falta, se muestran todas las categorías.
   */
  hiddenGroupCategories?: string[];
  /**
   * Nombre del tab de expo-router que representa este evento (ej.
   * `'visitapapa'`). Lo usa el banner de la Home para el gating de visibilidad
   * (solo se muestra si el perfil tiene acceso al tab o al botón Home).
   * Vacío/ausente = sin tab propio (evento solo accesible desde "Más").
   */
  tabId?: string;
  sections: EventSection[];
}

// ─── Eventos ─────────────────────────────────────────────────────────

export const JUBILEO: EventConfig = {
  id: 'jubileo',
  title: 'Jubileo',
  tintColor: '#A3BD31',
  firebasePrefix: 'jubileo',
  status: 'archived',
  sections: [
    {
      label: 'Horario',
      subtitle: 'Minuto a minuto',
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
      subtitle: 'Conso+, Movilidad y Buses',
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
      subtitle: 'Las vas a necesitar...',
      emoji: '📲',
      materialIcon: 'apps',
      target: 'Apps',
      tintColor: '#FFB74D',
      firebaseKey: 'apps',
    },
  ],
};

export const VISITAPAPA: EventConfig = {
  id: 'visitapapa26',
  title: 'Visita Papa León XIV 2026',
  tintColor: '#FCD200',
  heroImage: require('@/assets/alzalamirada.png'),
  firebasePrefix: 'activities/visitapapa26',
  status: 'active',
  bannerText: 'Horarios, materiales y todo para vivir un momento histórico',
  tabId: 'visitapapa',
  hiddenGroupCategories: ['Alojamiento'],
  sections: [
    {
      label: 'Horario',
      subtitle: 'Minuto a minuto',
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
      // Sección-enlace: abre una lista de Google Maps en vez de navegar.
      label: 'Comida de Domingo',
      subtitle: 'Lista de Google Maps',
      emoji: '🍽️',
      materialIcon: 'restaurant',
      tintColor: '#F06292',
      url: 'https://maps.app.goo.gl/7DEtUhW1tfrnY9Sk7',
    },
    {
      label: 'Sectores Eventos',
      subtitle: 'Consulta donde estaremos',
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
      subtitle: 'Conso+, movilidad y buses',
      emoji: '👥',
      materialIcon: 'groups',
      target: 'Grupos',
      tintColor: '#FFD54F',
      firebaseKey: 'grupos',
    },
    {
      label: 'Contactos',
      subtitle: 'Por si te hacen falta',
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
    {
      label: 'Evalúa la actividad',
      subtitle: 'Cuéntanos qué tal ha ido',
      emoji: '⭐',
      materialIcon: 'star-rate',
      target: 'Evaluacion',
      tintColor: '#FCD200',
      firebaseKey: 'evaluacion',
    },
  ],
};

// ─── Registry ────────────────────────────────────────────────────────

export const EVENTS: Record<string, EventConfig> = {
  [JUBILEO.id]: JUBILEO,
  [VISITAPAPA.id]: VISITAPAPA,
};

/**
 * Evento activo / destacado ("modo evento"): la app lo resalta con tab propia,
 * botón en la Home y banner. También es el evento por defecto.
 *
 * TODO (mcmpanel/Firebase): mover esta decisión al nodo `activities/` para
 * poder activar/archivar eventos sin desplegar. Ver PROMPT_MCMPANEL_VISITAPAPA.md.
 */
export const ACTIVE_EVENT_ID = VISITAPAPA.id;

export const DEFAULT_EVENT_ID = ACTIVE_EVENT_ID;

/** Devuelve la config del evento. Cae al evento activo si el id es inválido. */
export function getEvent(id?: string | null): EventConfig {
  if (!id) return EVENTS[DEFAULT_EVENT_ID];
  return EVENTS[id] ?? EVENTS[DEFAULT_EVENT_ID];
}

/** Eventos archivados (pasados), para "Más > Eventos pasados". */
export function getArchivedEvents(): EventConfig[] {
  return Object.values(EVENTS).filter((e) => e.status === 'archived');
}

/** Path de Firebase de una sección: `<firebasePrefix>/<key>`. */
export function getEventFirebasePath(event: EventConfig, key: string): string {
  return `${event.firebasePrefix}/${key}`;
}

/** Clave de caché AsyncStorage de una sección: `<id>_<key>`. */
export function getEventCacheKey(event: EventConfig, key: string): string {
  return `${event.id}_${key}`;
}

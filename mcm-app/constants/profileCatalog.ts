// Catálogo de IDs "ground truth" que la app conoce hoy. Sirven para validar la
// config remota: cualquier ID desconocido se filtra con un warning en consola
// para evitar que un error del panel admin rompa la UI.
//
// Si añades un nuevo tab / home button / mas item / etc., añádelo aquí también.

/** Tabs existentes en `app/(tabs)/_layout.tsx` → `TABS_CONFIG`. */
export const KNOWN_TABS = [
  'index',
  'cancionero',
  'contigo',
  'calendario',
  'fotos',
  'comunica',
  'mas',
] as const;

/** Botones del grid del Home (`app/(tabs)/index.tsx` → `quickItems`). */
export const KNOWN_HOME_BUTTONS = [
  'comunica',
  'cancionero',
  'fotos',
  'evangelio',
  'mas',
] as const;

/** Items del menú "Más" (`app/screens/MasHomeScreen.tsx`). */
export const KNOWN_MAS_ITEMS = [
  'comunica',
  'comunica-gestion',
  'jubileo',
] as const;

/**
 * Tags de álbum soportados. El valor especial `'all'` significa "ver todo".
 * Álbumes sin tag se consideran equivalentes a `['general']` (visibles por defecto).
 */
export const KNOWN_ALBUM_TAGS = [
  'all',
  'general',
  'encuentros',
  'interno',
  'monitores',
  'miembros',
] as const;

/**
 * Topics de notificaciones soportados para segmentación desde el panel admin.
 * `general` se entiende como "todos".
 */
export const KNOWN_NOTIFICATION_TOPICS = [
  'general',
  'eventos',
  'familias',
  'monitores',
  'miembros',
] as const;

export type KnownTabId = (typeof KNOWN_TABS)[number];
export type KnownHomeButtonId = (typeof KNOWN_HOME_BUTTONS)[number];
export type KnownMasItemId = (typeof KNOWN_MAS_ITEMS)[number];
export type KnownAlbumTag = (typeof KNOWN_ALBUM_TAGS)[number];
export type KnownNotificationTopic = (typeof KNOWN_NOTIFICATION_TOPICS)[number];

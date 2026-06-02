// utils/notificationRoutes.ts
//
// Utilidades compartidas para procesar el `internalRoute` y el botón de acción
// que llegan en una notificación push (desde el MCM Panel) y en el historial de
// Firebase. Centraliza dos cosas:
//
//   1. normalizeNotificationRoute(): convierte cualquier ruta que mande el panel
//      a una ruta REAL del router de la app. Tolera rutas "desnudas"
//      (`cancionero`), el grupo `(tabs)` y un mapa de ALIAS para rutas heredadas
//      o incorrectas que el panel pueda seguir enviando (p. ej. `actividades`,
//      `jubileo`, `albums`, `wordle`). Así un error de configuración del panel
//      no deja al usuario en una pantalla 404.
//
//   2. extractActionButton(): normaliza el botón de acción. El contrato del panel
//      define `data.actionButtons` (array) pero la app trabaja con un único
//      `actionButton` (objeto con `isInternal`). Esta función acepta ambos
//      formatos y devuelve siempre la forma canónica.

/**
 * Rutas que el panel puede enviar pero que NO existen como ruta propia en el
 * router. Se mapean a la ruta real equivalente.
 *
 * - `actividades` / `jubileo` → viven dentro del stack de "Más" (`/(tabs)/mas`).
 * - `albums` / `album`        → la galería es la tab "fotos".
 * - `wordle`                  → ruta raíz, no está bajo `(tabs)`.
 * - `(tabs)/notifications`    → el centro de notificaciones es ruta raíz
 *                                `/notifications`, no una tab.
 */
const ROUTE_ALIASES: Record<string, string> = {
  '/(tabs)/notifications': '/notifications',
  '/(tabs)/actividades': '/(tabs)/mas',
  '/(tabs)/jubileo': '/(tabs)/mas',
  '/(tabs)/albums': '/(tabs)/fotos',
  '/(tabs)/album': '/(tabs)/fotos',
  '/(tabs)/wordle': '/wordle',
  '/actividades': '/(tabs)/mas',
  '/jubileo': '/(tabs)/mas',
  '/albums': '/(tabs)/fotos',
  '/album': '/(tabs)/fotos',
};

/** Segmentos que SÍ son tabs reales bajo `app/(tabs)/`. */
const TAB_PATHS = [
  'cancionero',
  'calendario',
  'fotos',
  'mas',
  'index',
  'contigo',
  'visitapapa',
];

/**
 * Normaliza una ruta de notificación a una ruta real del router de Expo.
 * Las URLs externas (http/https) se devuelven sin tocar.
 */
export function normalizeNotificationRoute(route: string): string {
  if (!route) return '';
  let clean = route.trim();
  if (/^https?:\/\//i.test(clean)) return clean;

  // Colapsar barras repetidas y quitar la barra final (salvo en la raíz).
  clean = clean.replace(/\/+/g, '/');
  if (clean.length > 1 && clean.endsWith('/')) clean = clean.slice(0, -1);

  // Alias directo sobre el valor tal cual lo manda el panel.
  if (ROUTE_ALIASES[clean]) return ROUTE_ALIASES[clean];

  const naked = clean.startsWith('/') ? clean.slice(1) : clean;

  let resolved: string;
  if (naked.startsWith('(tabs)/')) {
    resolved = '/' + naked;
  } else if (TAB_PATHS.some((p) => naked === p || naked.startsWith(p + '/'))) {
    resolved = '/(tabs)/' + naked;
  } else {
    resolved = '/' + naked;
  }

  // Re-aplicar alias sobre la ruta ya resuelta (cubre el caso de rutas
  // desnudas que tras prefijarse coinciden con un alias).
  return ROUTE_ALIASES[resolved] ?? resolved;
}

export interface NotificationActionButton {
  text: string;
  url: string;
  isInternal: boolean;
}

/**
 * Extrae el botón de acción de los datos de una notificación, aceptando tanto
 * el formato canónico de la app (`actionButton`, objeto) como el del contrato
 * del panel (`actionButtons`, array — se usa el primer elemento).
 *
 * Si `isInternal` no viene explícito, se infiere: una ruta interna NO empieza
 * por `http(s)://`.
 */
export function extractActionButton(
  data: Record<string, any> | null | undefined,
): NotificationActionButton | undefined {
  if (!data) return undefined;

  const raw =
    data.actionButton ??
    (Array.isArray(data.actionButtons) ? data.actionButtons[0] : undefined);

  if (!raw || typeof raw !== 'object' || !raw.url) return undefined;

  const url = String(raw.url);
  const isInternal =
    typeof raw.isInternal === 'boolean'
      ? raw.isInternal
      : !/^https?:\/\//i.test(url);

  return { text: String(raw.text ?? 'Ver'), url, isInternal };
}

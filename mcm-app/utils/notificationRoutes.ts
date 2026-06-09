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
//   2. extractActionButtons(): normaliza los botones de acción. Una notificación
//      puede llevar hasta 3 botones. Acepta tanto `data.actionButtons` (array)
//      como `data.actionButton` (objeto único, legacy) y devuelve siempre un
//      array canónico (máx. 3). `extractActionButton()` se conserva como atajo
//      al primer botón para compatibilidad hacia atrás.

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

/** Máximo de botones de acción que la app renderiza por notificación. */
export const MAX_ACTION_BUTTONS = 3;

/**
 * Normaliza un objeto crudo de botón (`{ text, url, isInternal? }`) a la forma
 * canónica. Devuelve `undefined` si no es válido (sin `url`).
 *
 * Si `isInternal` no viene explícito, se infiere: una ruta interna NO empieza
 * por `http(s)://`.
 */
function normalizeButton(raw: any): NotificationActionButton | undefined {
  if (!raw || typeof raw !== 'object' || !raw.url) return undefined;

  const url = String(raw.url);
  const isInternal =
    typeof raw.isInternal === 'boolean'
      ? raw.isInternal
      : !/^https?:\/\//i.test(url);

  return { text: String(raw.text ?? 'Ver'), url, isInternal };
}

/**
 * Extrae TODOS los botones de acción de los datos de una notificación (máx. 3),
 * aceptando tanto el formato con múltiples botones (`actionButtons`, array) como
 * el legacy de un único botón (`actionButton`, objeto). Si vienen ambos, se
 * combinan: primero el objeto único y después el array (deduplicando por
 * `url|text`). El resultado siempre es un array canónico (puede estar vacío).
 */
export function extractActionButtons(
  data: Record<string, any> | null | undefined,
): NotificationActionButton[] {
  if (!data) return [];

  const candidates: any[] = [];
  if (data.actionButton) candidates.push(data.actionButton);
  if (Array.isArray(data.actionButtons)) candidates.push(...data.actionButtons);

  const seen = new Set<string>();
  const buttons: NotificationActionButton[] = [];
  for (const candidate of candidates) {
    const button = normalizeButton(candidate);
    if (!button) continue;
    const key = `${button.url}|${button.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    buttons.push(button);
    if (buttons.length >= MAX_ACTION_BUTTONS) break;
  }
  return buttons;
}

/**
 * Atajo: devuelve el primer botón de acción (o `undefined`). Se conserva para
 * los puntos del código que solo necesitan un botón y para compatibilidad.
 */
export function extractActionButton(
  data: Record<string, any> | null | undefined,
): NotificationActionButton | undefined {
  return extractActionButtons(data)[0];
}

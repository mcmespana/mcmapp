import { MaterialIcons } from '@expo/vector-icons';

/**
 * Helpers de presentación para la UI de notificaciones (lista + detalle).
 * Extraído de NotificationsBottomSheet. Son funciones puras (testeables sin
 * mocks): mapeo de rutas internas a etiqueta+icono, normalización de rutas y
 * formato relativo de fechas.
 *
 * Nota: existe otra normalización de rutas en `utils/notificationRoutes.ts`
 * (`normalizeNotificationRoute`) con lógica distinta; NO son la misma función.
 */

export const ROUTE_LABELS: Record<
  string,
  { label: string; icon: keyof typeof MaterialIcons.glyphMap }
> = {
  '/(tabs)/calendario': { label: 'Calendario', icon: 'calendar-today' },
  '/(tabs)/fotos': { label: 'Fotos', icon: 'photo-library' },
  '/(tabs)/cancionero': { label: 'Cantoral', icon: 'music-note' },
  '/(tabs)/mas': { label: 'Más', icon: 'more-horiz' },
  '/(tabs)/index': { label: 'Inicio', icon: 'home' },
  '/wordle': { label: 'Wordle', icon: 'games' },
  '/(tabs)/contigo': { label: 'Contigo', icon: 'favorite' },
  '/(tabs)/contigo/evangelio': { label: 'Evangelio', icon: 'menu-book' },
  '/(tabs)/contigo/oracion': { label: 'Oración', icon: 'brightness-3' },
  '/(tabs)/contigo/revision': { label: 'Revisión', icon: 'rate-review' },
  '/(tabs)/contigo/bookmarks': { label: 'Favoritos', icon: 'bookmark' },
};

export function normalizeRoute(route: string): string {
  if (!route) return '';
  let clean = route.trim();
  if (clean.startsWith('http')) return clean;

  clean = clean.replace(/\/+/g, '/');

  const hasSlash = clean.startsWith('/');
  const naked = hasSlash ? clean.substring(1) : clean;

  if (naked.startsWith('(tabs)/')) {
    return '/' + naked;
  }

  const tabPaths = [
    'cancionero',
    'calendario',
    'fotos',
    'mas',
    'index',
    'contigo',
  ];

  const isTab = tabPaths.some((p) => naked === p || naked.startsWith(p + '/'));
  if (isTab) {
    return '/(tabs)/' + naked;
  }

  return '/' + naked;
}

export function getRouteLabel(route: string) {
  const norm = normalizeRoute(route);
  return ROUTE_LABELS[norm] ?? ROUTE_LABELS[route] ?? null;
}

export function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  if (hours < 24) return `Hace ${hours} h`;
  if (days < 7) return `Hace ${days} d`;
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

import { MaterialIcons } from '@/components/ui/icons';
import { normalizeNotificationRoute } from '@/utils/notificationRoutes';
import type {
  NotificationActionButtonData,
  NotificationData,
  ReceivedNotification,
} from '@/types/notifications';

/**
 * Helpers de presentación para la UI de notificaciones (lista + detalle).
 * Extraído de NotificationsBottomSheet. Son funciones puras (testeables sin
 * mocks): mapeo de rutas internas a etiqueta+icono, normalización de rutas y
 * formato relativo de fechas.
 *
 * La normalización de rutas es la de `utils/notificationRoutes.ts` (con alias
 * para las rutas heredadas del panel). Hubo aquí una copia más corta, sin
 * alias, y la hoja de notificaciones navegaba con ella a rutas que no existen.
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
  '/notifications': { label: 'Notificaciones', icon: 'notifications' },
};

export function normalizeRoute(route: string): string {
  return normalizeNotificationRoute(route);
}

export function getRouteLabel(route: string) {
  const norm = normalizeRoute(route);
  return ROUTE_LABELS[norm] ?? ROUTE_LABELS[route] ?? null;
}

/**
 * Botones de acción de una notificación (hasta 3). Soporta el array
 * `actionButtons` (formato actual) y el `actionButton` único (legacy y
 * notificaciones antiguas cacheadas). Lo usan la lista, la hoja y el detalle,
 * para que la misma notificación enseñe los mismos botones se abra por donde
 * se abra.
 */
export function getActionButtons(
  notification: NotificationData | ReceivedNotification,
): NotificationActionButtonData[] {
  if (notification.actionButtons && notification.actionButtons.length > 0) {
    return notification.actionButtons;
  }
  return notification.actionButton ? [notification.actionButton] : [];
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

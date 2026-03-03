import { useNotifications } from '@/contexts/NotificationsContext';

/**
 * Hook para obtener el contador de notificaciones sin leer.
 * Delegado al NotificationsContext (real-time via Firebase + foreground updates).
 */
export default function useUnreadNotificationsCount() {
  const { unreadCount, refreshCount } = useNotifications();

  return { unreadCount, loading: false, refresh: refreshCount };
}

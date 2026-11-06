import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router/react-navigation';
import { logger } from '@/utils/logger';
import {
  getDismissedNotificationKeys,
  getForcedUnreadIds,
  getLocalNotificationsHistory,
  getReadNotificationIds,
  initializeNewUserReadStatus,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  markNotificationAsUnread,
} from '@/services/pushNotificationService';
import { useNotifications } from '@/contexts/NotificationsContext';
import type { ReceivedNotification } from '@/types/notifications';
import {
  isInboxRead,
  mergeInbox,
  type InboxNotification,
} from '@/utils/notificationsInbox';

/**
 * Estado y acciones de la bandeja de notificaciones. Es EL sitio donde se
 * decide qué se ve, qué está leído y qué se ha borrado: la lista, el detalle y
 * lo que venga después leen de aquí, para que dos pantallas no discrepen.
 *
 * Marcar como leída es optimista (la pantalla responde al instante) y luego
 * recarga del almacenamiento, que es la fuente de verdad. NO hay «eliminar»:
 * las notificaciones se quedan (decisión del propietario, 06/11/2026); las que
 * se borraron en versiones anteriores siguen ocultas.
 */
export function useNotificationsInbox() {
  const { firebaseNotifications, refreshCount } = useNotifications();
  const [local, setLocal] = useState<ReceivedNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [forcedUnread, setForcedUnread] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [localNotifs, ids, gone, forced] = await Promise.all([
        getLocalNotificationsHistory(),
        getReadNotificationIds(),
        getDismissedNotificationKeys(),
        getForcedUnreadIds(),
      ]);
      setLocal(localNotifs);
      setReadIds(new Set(ids));
      setDismissed(gone);
      setForcedUnread(forced);
    } catch (error) {
      logger.error('Error cargando notificaciones:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Al volver a la pantalla (también desde el detalle) se relee todo.
  useFocusEffect(
    useCallback(() => {
      load();
      refreshCount();
    }, [load, refreshCount]),
  );

  // Primer uso: lo histórico se da por leído para no abrir con 40 sin leer.
  useEffect(() => {
    if (firebaseNotifications.length === 0) return;
    initializeNewUserReadStatus(firebaseNotifications).then((didInit) => {
      if (didInit) {
        load();
        refreshCount();
      }
    });
  }, [firebaseNotifications, load, refreshCount]);

  const items = useMemo(
    () => mergeInbox(local, firebaseNotifications, dismissed),
    [local, firebaseNotifications, dismissed],
  );

  const isRead = useCallback(
    (n: InboxNotification) => isInboxRead(n, readIds, new Date(), forcedUnread),
    [readIds, forcedUnread],
  );

  const unreadCount = useMemo(
    () =>
      items.filter((n) => !isInboxRead(n, readIds, new Date(), forcedUnread))
        .length,
    [items, readIds, forcedUnread],
  );

  const markRead = useCallback(
    async (id: string) => {
      setReadIds((prev) => new Set(prev).add(id));
      await markNotificationAsRead(id);
      await load();
      refreshCount();
    },
    [load, refreshCount],
  );

  const markUnread = useCallback(
    async (id: string) => {
      await markNotificationAsUnread(id);
      await load();
      refreshCount();
    },
    [load, refreshCount],
  );

  const markAllRead = useCallback(async () => {
    const unread = items.filter(
      (n) => !isInboxRead(n, readIds, new Date(), forcedUnread),
    );
    if (unread.length === 0) return;
    setReadIds((prev) => {
      const next = new Set(prev);
      unread.forEach((n) => next.add(n.id));
      return next;
    });
    await markAllNotificationsAsRead(unread.map((n) => n.id));
    await load();
    refreshCount();
  }, [items, readIds, forcedUnread, load, refreshCount]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const findById = useCallback(
    (id: string | undefined) =>
      id ? (items.find((n) => n.id === id) ?? null) : null,
    [items],
  );

  return {
    items,
    loading,
    refreshing,
    refresh,
    isRead,
    unreadCount,
    markRead,
    markUnread,
    markAllRead,
    findById,
  };
}

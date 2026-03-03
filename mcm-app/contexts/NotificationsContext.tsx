import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  getUnreadNotificationsCount,
  subscribeToNotifications,
  getReadNotificationIds,
} from '@/services/pushNotificationService';
import { NotificationData } from '@/types/notifications';

interface NotificationsContextValue {
  unreadCount: number;
  firebaseNotifications: NotificationData[];
  readIds: Set<string>;
  refreshCount: () => void;
  markAllRefresh: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue>({
  unreadCount: 0,
  firebaseNotifications: [],
  readIds: new Set(),
  refreshCount: () => {},
  markAllRefresh: () => {},
});

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [firebaseNotifications, setFirebaseNotifications] = useState<
    NotificationData[]
  >([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const updateCount = useCallback(async () => {
    try {
      const count = await getUnreadNotificationsCount();
      setUnreadCount(count);
      const ids = await getReadNotificationIds();
      setReadIds(ids);
    } catch (error) {
      console.error('Error actualizando contador de notificaciones:', error);
    }
  }, []);

  // Suscripción en tiempo real a Firebase
  useEffect(() => {
    const unsubscribe = subscribeToNotifications((notifications) => {
      setFirebaseNotifications(notifications);
    });
    return unsubscribe;
  }, []);

  // Actualizar count cuando cambian las notificaciones de Firebase o readIds
  useEffect(() => {
    updateCount();
  }, [firebaseNotifications, updateCount]);

  // Actualizar cuando la app vuelve al foreground
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
          updateCount();
        }
      },
    );
    return () => subscription.remove();
  }, [updateCount]);

  const markAllRefresh = useCallback(() => {
    updateCount();
  }, [updateCount]);

  return (
    <NotificationsContext.Provider
      value={{
        unreadCount,
        firebaseNotifications,
        readIds,
        refreshCount: updateCount,
        markAllRefresh,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}

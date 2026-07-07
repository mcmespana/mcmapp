import { logger } from '@/utils/logger';
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  getUnreadNotificationsCount,
  subscribeToNotifications,
  getReadNotificationIds,
} from '@/services/pushNotificationService';
import { NotificationData } from '@/types/notifications';
import {
  notificationMatchesUser,
  NotificationAudienceUser,
} from '@/utils/notificationAudience';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useEventSubscriptions } from '@/contexts/EventSubscriptionsContext';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';

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
  // Historial remoto crudo tal cual llega de Firebase (sin filtrar por audiencia).
  const [rawFirebaseNotifications, setRawFirebaseNotifications] = useState<
    NotificationData[]
  >([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  // Identidad del usuario para el match de audiencia. Misma forma que la
  // metadata que se guarda en /pushTokens: perfil + delegación + unión de
  // topics (perfil/delegación + suscripciones a eventos). Ver
  // usePushNotifications.ts (la fuente de esa metadata).
  const { profile } = useUserProfile();
  const resolved = useResolvedProfileConfig();
  const { eventTopics } = useEventSubscriptions();

  const audienceUser = useMemo<NotificationAudienceUser>(
    () => ({
      profileType: profile.profileType,
      delegationId: profile.delegationId,
      topics: Array.from(
        new Set([...resolved.notificationTopics, ...eventTopics]),
      ),
    }),
    [
      profile.profileType,
      profile.delegationId,
      resolved.notificationTopics,
      eventTopics,
    ],
  );

  // Ref para que updateCount (expuesto como refreshCount) se mantenga estable y
  // pueda leer siempre la audiencia más reciente sin recrearse.
  const audienceUserRef = useRef(audienceUser);
  useEffect(() => {
    audienceUserRef.current = audienceUser;
  }, [audienceUser]);

  // Historial visible para este usuario: se descartan los avisos dirigidos a
  // otra audiencia (perfil/delegación/evento). Los registros sin `audience` o
  // sin ejes activos se consideran "para todos" y siguen visibles.
  const firebaseNotifications = useMemo(
    () =>
      rawFirebaseNotifications.filter((n) =>
        notificationMatchesUser(n.audience, audienceUser),
      ),
    [rawFirebaseNotifications, audienceUser],
  );

  const updateCount = useCallback(async () => {
    try {
      const count = await getUnreadNotificationsCount((n) =>
        notificationMatchesUser(n.audience, audienceUserRef.current),
      );
      setUnreadCount(count);
      const ids = await getReadNotificationIds();
      setReadIds(ids);
    } catch (error) {
      logger.error('Error actualizando contador de notificaciones:', error);
    }
  }, []);

  // Suscripción en tiempo real a Firebase
  useEffect(() => {
    const unsubscribe = subscribeToNotifications((notifications) => {
      setRawFirebaseNotifications(notifications);
    });
    return unsubscribe;
  }, []);

  // Actualizar count cuando cambian las notificaciones de Firebase, la
  // audiencia del usuario o readIds.
  useEffect(() => {
    updateCount();
  }, [rawFirebaseNotifications, audienceUser, updateCount]);

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

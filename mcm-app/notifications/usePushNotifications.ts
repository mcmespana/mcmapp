// notifications/usePushNotifications.ts
//
// Hook principal de notificaciones push. Solo funciona en iOS/Android (web no soportado).
//
// Flujo al montar:
//   1. registerAndSaveToken() — pide permisos → obtiene Expo Push Token → lo cachea en AsyncStorage → lo guarda en Firebase
//   2. updateLastActive() — escribe heartbeat en Firebase (se ejecuta después de 1 para que el token ya esté cacheado)
//   3. Se inicia un intervalo de heartbeat cada 5 min
//   4. Se registran dos listeners:
//      a. notificationReceived — app en foreground: guarda la notificación localmente y actualiza badge
//      b. notificationResponse — usuario toca la notificación: navega a la ruta correspondiente y marca como leída
//
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import {
  saveTokenToFirebase,
  cachePushToken,
  updateLastActive,
  saveReceivedNotificationLocally,
  markNotificationAsRead,
} from '@/services/pushNotificationService';
import { ReceivedNotification } from '@/types/notifications';
import { useNotifications } from '@/contexts/NotificationsContext';
import { router } from 'expo-router';

/**
 * Genera un ID estable y determinístico para una notificación.
 * Si el backend envía `data.id`, lo usa. Si no, genera un hash
 * basado en título+cuerpo para que la misma notificación siempre
 * tenga el mismo ID independientemente de cuántas veces se entregue.
 *
 * Esto soluciona el problema de que `notification.request.identifier`
 * es un UUID aleatorio por cada entrega, lo que causaba que la
 * deduplicación fallara y aparecieran duplicados.
 */
function getStableNotificationId(content: Notifications.NotificationContent): string {
  // 1. ID explícito del backend — siempre preferido
  if (content.data?.id && typeof content.data.id === 'string') {
    return content.data.id;
  }

  // 2. ID determinístico basado en contenido (título + cuerpo)
  // Simple hash numérico convertido a string — suficiente para deduplicación
  const raw = `${content.title || ''}|${content.body || ''}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return `local_${Math.abs(hash).toString(36)}`;
}

// Mapeo de actionIdentifier de iOS a rutas internas
const ACTION_ROUTES: Record<string, string> = {
  view: '/(tabs)/notifications',
  view_event: '/(tabs)/calendario',
  view_photos: '/(tabs)/fotos',
};

export default function usePushNotifications() {
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const { refreshCount } = useNotifications();

  useEffect(() => {
    // Registrar token y guardar en Firebase, luego heartbeat inicial
    registerAndSaveToken().then(() => {
      updateLastActive().catch(() => {});
    });

    // Actualizar última actividad periódicamente (cada 5 minutos)
    const intervalId = setInterval(
      () => {
        updateLastActive().catch(() => {});
      },
      5 * 60 * 1000,
    );

    // Listener para notificaciones recibidas (app en foreground)
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        const notificationId = getStableNotificationId(notification.request.content);
        const receivedNotification: ReceivedNotification = {
          id: notificationId,
          title: notification.request.content.title || 'Notificación',
          body: notification.request.content.body || '',
          icon: notification.request.content.data?.icon as string | undefined,
          imageUrl: notification.request.content.data?.imageUrl as
            | string
            | undefined,
          actionButton: notification.request.content.data?.actionButton as any,
          receivedAt: new Date().toISOString(),
          isRead: false,
          category: notification.request.content.data?.category as any,
          internalRoute: notification.request.content.data?.internalRoute as
            | string
            | undefined,
          data: notification.request.content.data,
        };

        saveReceivedNotificationLocally(receivedNotification)
          .then(() => {
            // Actualizar badge en tiempo real al recibir en foreground
            refreshCount();
          })
          .catch(() => {});
      });

    // Listener para cuando el usuario toca la notificación
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        const actionIdentifier = response.actionIdentifier;

        // Determinar ruta de navegación
        let targetRoute: string | undefined;

        // 1. iOS action buttons (view, view_event, view_photos)
        if (
          actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER &&
          ACTION_ROUTES[actionIdentifier]
        ) {
          targetRoute = ACTION_ROUTES[actionIdentifier];
        }
        // 2. Ruta interna especificada en la notificación
        else if (data?.internalRoute) {
          targetRoute = data.internalRoute as string;
        }

        if (targetRoute) {
          try {
            router.navigate(targetRoute as any);
          } catch {}
        }

        // Guardar y marcar como leída
        const notificationId = getStableNotificationId(response.notification.request.content);
        const receivedNotification: ReceivedNotification = {
          id: notificationId,
          title: response.notification.request.content.title || 'Notificación',
          body: response.notification.request.content.body || '',
          icon: data?.icon as string | undefined,
          imageUrl: data?.imageUrl as string | undefined,
          actionButton: data?.actionButton as any,
          receivedAt: new Date().toISOString(),
          isRead: false,
          category: data?.category as any,
          internalRoute: data?.internalRoute as string | undefined,
          data,
        };

        saveReceivedNotificationLocally(receivedNotification)
          .then(() => markNotificationAsRead(receivedNotification.id))
          .then(() => refreshCount())
          .catch(() => {});
      });

    // Cleanup
    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
      clearInterval(intervalId);
    };
  }, [refreshCount]);
}

/**
 * Flujo completo: permisos → token → guardar en Firebase
 * Con logging detallado para diagnosticar problemas
 */
async function registerAndSaveToken() {
  if (Platform.OS === 'web') return;

  try {
    // 1. Permisos
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return;
    }

    // 2. Canal Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Notificaciones MCM',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#253883',
      });
    }

    // 3. Obtener token
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

    const token = tokenResponse.data;
    if (!token) {
      return;
    }

    // 4. Cachear
    await cachePushToken(token);

    // 5. Guardar en Firebase
    await saveTokenToFirebase(token);
  } catch {}
}

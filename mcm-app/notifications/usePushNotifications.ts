// notifications/usePushNotifications.ts
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import {
  saveTokenToFirebase,
  updateLastActive,
  saveReceivedNotificationLocally,
  markNotificationAsRead,
} from '@/services/pushNotificationService';
import { ReceivedNotification } from '@/types/notifications';
import { useNotifications } from '@/contexts/NotificationsContext';
import { router } from 'expo-router';

// Mapeo de actionIdentifier de iOS a rutas internas
const ACTION_ROUTES: Record<string, string> = {
  view: '/notifications',
  view_event: '/(tabs)/calendario',
  view_photos: '/(tabs)/fotos',
};

export default function usePushNotifications() {
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const { refreshCount } = useNotifications();

  useEffect(() => {
    // Pedir permiso de notificaciones
    askNotificationPermission()
      .then((status) => {
        if (
          (status as unknown as Notifications.PermissionStatus) ===
          Notifications.PermissionStatus.GRANTED
        ) {
          registerForPushNotificationsAsync().then((token) => {
            if (token) {
              console.log('🥳 Expo Push Token:', token);
              saveTokenToFirebase(token).catch((err) =>
                console.error('Error guardando token:', err),
              );
            }
          });
        }
      })
      .catch(console.error);

    // Actualizar última actividad periódicamente (cada 5 minutos)
    const intervalId = setInterval(
      () => {
        updateLastActive().catch((err) =>
          console.error('Error actualizando lastActive:', err),
        );
      },
      5 * 60 * 1000,
    );

    // Listener para notificaciones recibidas (app en foreground)
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log('🔔 Notificación recibida:', notification.request.content);

        const notificationId =
          (notification.request.content.data?.id as string) ||
          notification.request.identifier;
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
          .catch((err) =>
            console.error('Error guardando notificación localmente:', err),
          );
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
            router.push(targetRoute as any);
          } catch (error) {
            console.error('Error navegando a ruta:', error);
          }
        }

        // Guardar y marcar como leída
        const notificationId =
          (data?.id as string) || response.notification.request.identifier;
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
          .catch((err) => console.error('Error procesando notificación:', err));
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

/** Solicita permisos de notificaciones */
async function askNotificationPermission(): Promise<Notifications.NotificationPermissionsStatus> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== Notifications.PermissionStatus.GRANTED) {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus as unknown as Notifications.NotificationPermissionsStatus;
}

/** Registra el dispositivo para recibir notificaciones push */
async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Notificaciones MCM',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#253883',
    });
  }

  if (Constants.isDevice) {
    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
        
      if (!projectId) {
         console.warn("No se encontró projectId, intentando obtener token sin projectId...");
      }
      
      const { data } = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      return data;
    } catch (error) {
      console.error('Error obteniendo token de notificaciones:', error);
      alert('Error Push Token: ' + String(error));
      return null;
    }
  }
  return null;
}

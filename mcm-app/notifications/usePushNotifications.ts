// notifications/usePushNotifications.ts
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { saveTokenToFirebase, updateLastActive, saveReceivedNotificationLocally } from '@/services/pushNotificationService';
import { ReceivedNotification } from '@/types/notifications';
import { router } from 'expo-router';

export default function usePushNotifications() {
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    // Pedir permiso de notificaciones
    askNotificationPermission()
      .then((status) => {
        if (
          (status as unknown as Notifications.PermissionStatus) ===
          Notifications.PermissionStatus.GRANTED
        ) {
          // Si se conceden permisos, registra canal y obtén token
          registerForPushNotificationsAsync().then((token) => {
            if (token) {
              console.log('🥳 Expo Push Token:', token);
              console.log('📋 Copia este token para enviar notificaciones desde:');
              console.log('https://expo.dev/notifications');

              // Guardar token en Firebase
              saveTokenToFirebase(token).catch(err =>
                console.error('Error guardando token:', err)
              );
            }
          });
        } else {
          console.log('⚠️ Permisos de notificaciones denegados');
        }
      })
      .catch(console.error);

    // Actualizar última actividad periódicamente (cada 5 minutos)
    const intervalId = setInterval(() => {
      updateLastActive().catch(err =>
        console.error('Error actualizando lastActive:', err)
      );
    }, 5 * 60 * 1000);

    // Listener para notificaciones recibidas (app en foreground)
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log('🔔 Notificación recibida:', notification.request.content);

        // Guardar en historial local
        const receivedNotification: ReceivedNotification = {
          id: notification.request.identifier,
          title: notification.request.content.title || 'Notificación',
          body: notification.request.content.body || '',
          icon: notification.request.content.data?.icon as string | undefined,
          imageUrl: notification.request.content.data?.imageUrl as string | undefined,
          actionButton: notification.request.content.data?.actionButton as any,
          receivedAt: new Date().toISOString(),
          isRead: false,
          category: notification.request.content.data?.category as any,
          internalRoute: notification.request.content.data?.internalRoute as string | undefined,
          data: notification.request.content.data,
        };

        saveReceivedNotificationLocally(receivedNotification).catch(err =>
          console.error('Error guardando notificación localmente:', err)
        );
      });

    // Listener para cuando el usuario toca la notificación
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log('📲 Usuario tocó la notificación:', response.notification.request.content);

        const data = response.notification.request.content.data;

        // Navegación interna si hay una ruta especificada
        if (data?.internalRoute) {
          try {
            router.push(data.internalRoute as any);
            console.log('🧭 Navegando a:', data.internalRoute);
          } catch (error) {
            console.error('Error navegando a ruta interna:', error);
          }
        }

        // Guardar en historial local si no estaba ya
        const receivedNotification: ReceivedNotification = {
          id: response.notification.request.identifier,
          title: response.notification.request.content.title || 'Notificación',
          body: response.notification.request.content.body || '',
          icon: data?.icon as string | undefined,
          imageUrl: data?.imageUrl as string | undefined,
          actionButton: data?.actionButton as any,
          receivedAt: new Date().toISOString(),
          isRead: true, // Marcada como leída porque la tocó
          category: data?.category as any,
          internalRoute: data?.internalRoute as string | undefined,
          data,
        };

        saveReceivedNotificationLocally(receivedNotification).catch(err =>
          console.error('Error guardando notificación localmente:', err)
        );
      });

    // Cleanup
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
      clearInterval(intervalId);
    };
  }, []);
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
  // Configurar canal de Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Notificaciones MCM',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#253883',
    });
  }

  // Obtener token solo en dispositivo real
  if (Constants.isDevice) {
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const { data } = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      return data;
    } catch (error) {
      console.error('Error obteniendo token de notificaciones:', error);
      return null;
    }
  } else {
    console.log('⚠️ Las notificaciones push solo funcionan en dispositivos reales');
    return null;
  }
}

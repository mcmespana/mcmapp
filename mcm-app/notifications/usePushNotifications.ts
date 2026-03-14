// notifications/usePushNotifications.ts
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
    // Registrar token y guardar en Firebase
    registerAndSaveToken();

    // Actualizar última actividad inmediatamente al arrancar
    updateLastActive().catch((err) =>
      console.error('Error en heartbeat inicial:', err),
    );

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
          .catch((err) =>
            console.error('Error procesando notificación:', err),
          );
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
  try {
    // 1. Verificar/pedir permisos
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      console.log(
        '🔔 Permisos no concedidos, solicitando...',
        existingStatus,
      );
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('⚠️ Permisos de notificaciones denegados:', finalStatus);
      return;
    }

    console.log('✅ Permisos de notificaciones concedidos');

    // 2. Configurar canal Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Notificaciones MCM',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#253883',
      });
    }

    // 3. Obtener Expo Push Token
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    console.log('🔑 Obteniendo token con projectId:', projectId || '(auto)');

    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResponse.data;

    if (!token) {
      console.error('❌ getExpoPushTokenAsync devolvió token vacío');
      return;
    }

    console.log('🥳 Expo Push Token:', token);

    // 4. Cachear token (para que updateLastActive lo tenga como fallback)
    await cachePushToken(token);

    // 5. Guardar en Firebase
    await saveTokenToFirebase(token);
    console.log('✅ Token registrado exitosamente en Firebase');
  } catch (error) {
    console.error('❌ Error en registerAndSaveToken:', error);
  }
}

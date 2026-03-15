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
  getDeviceId,
} from '@/services/pushNotificationService';
import { ReceivedNotification } from '@/types/notifications';
import { useNotifications } from '@/contexts/NotificationsContext';
import { router } from 'expo-router';
import { getDatabase, ref, set } from 'firebase/database';
import { getFirebaseApp } from '@/hooks/firebaseApp';

/**
 * Escribe logs de diagnóstico en Firebase /debug/{deviceId}
 * Así puedes verlos en Firebase Console sin necesitar herramientas de desarrollo.
 * BORRAR cuando el problema esté resuelto.
 */
async function logToFirebase(data: Record<string, any>) {
  try {
    const deviceId = await getDeviceId();
    const db = getDatabase(getFirebaseApp());
    await set(ref(db, `debug/${deviceId}`), {
      ...data,
      platform: Platform.OS,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Silencioso: si esto falla también, al menos tenemos console.error
  }
}

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
    // Registrar token y guardar en Firebase, luego heartbeat inicial
    registerAndSaveToken().then(() => {
      updateLastActive().catch((err) =>
        console.error('Error en heartbeat inicial:', err),
      );
    });

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
  if (Platform.OS === 'web') return;

  try {
    // 1. Permisos
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    console.log('📋 [PASO 1] Estado de permisos:', existingStatus);

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('⚠️ Permisos denegados:', finalStatus);
      logToFirebase({ paso: 1, resultado: 'PERMISOS_DENEGADOS', finalStatus });
      return;
    }
    console.log('✅ [PASO 1] Permisos concedidos');

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
    console.log('📋 [PASO 3] projectId:', projectId || '(auto)');

    let tokenResponse;
    try {
      tokenResponse = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );
    } catch (tokenError: any) {
      const msg = tokenError?.message || String(tokenError);
      console.error('❌ [PASO 3] getExpoPushTokenAsync FALLÓ:', msg);
      logToFirebase({ paso: 3, resultado: 'TOKEN_ERROR', error: msg, projectId: projectId || '(auto)' });
      throw tokenError;
    }

    const token = tokenResponse.data;
    if (!token) {
      console.error('❌ [PASO 3] token vacío');
      logToFirebase({ paso: 3, resultado: 'TOKEN_VACIO' });
      return;
    }
    console.log('✅ [PASO 3] Token:', token.substring(0, 40) + '...');

    // 4. Cachear
    await cachePushToken(token);
    console.log('✅ [PASO 4] Token cacheado');

    // 5. Guardar en Firebase
    console.log('📋 [PASO 5] Guardando en Firebase...');
    await saveTokenToFirebase(token);
    console.log('✅ [PASO 5] Token guardado en Firebase');
    logToFirebase({ paso: 5, resultado: 'EXITO', token: token.substring(0, 30) + '...' });

  } catch (error: any) {
    const msg = error?.message || String(error);
    console.error('❌ Error en registerAndSaveToken:', msg);
    logToFirebase({ resultado: 'ERROR_GENERAL', error: msg });
  }
}



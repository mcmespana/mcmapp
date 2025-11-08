// services/pushNotificationService.ts
import { getDatabase, ref, set, get, onValue, off } from 'firebase/database';
import { getFirebaseApp } from '@/hooks/firebaseApp';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { DeviceToken, NotificationData, ReceivedNotification } from '@/types/notifications';

const DEVICE_ID_KEY = '@mcm_device_id';
const NOTIFICATIONS_HISTORY_KEY = '@mcm_notifications_history';
const READ_NOTIFICATIONS_KEY = '@mcm_read_notifications'; // IDs de notificaciones leídas (Firebase + locales)

/**
 * Genera o recupera el ID único del dispositivo
 */
export const getDeviceId = async (): Promise<string> => {
  try {
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch (error) {
    console.error('Error obteniendo device ID:', error);
    // Fallback: generar ID sin guardarlo
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
};

/**
 * Guarda el token de push en Firebase Realtime Database
 *
 * Estructura en Firebase:
 * /pushTokens
 *   /{deviceId}
 *     token: "ExponentPushToken[...]"
 *     platform: "ios" | "android" | "web"
 *     registeredAt: "2025-01-15T10:30:00.000Z"
 *     lastActive: "2025-01-15T10:30:00.000Z"
 *     appVersion: "1.0.1"
 *     deviceInfo: { ... }
 */
export const saveTokenToFirebase = async (token: string): Promise<void> => {
  try {
    const deviceId = await getDeviceId();
    const db = getDatabase(getFirebaseApp());

    const tokenData: DeviceToken = {
      token,
      platform: Platform.OS as 'ios' | 'android' | 'web',
      registeredAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      appVersion: Constants.expoConfig?.version || '1.0.0',
      deviceInfo: {
        model: Constants.deviceName || undefined,
        osVersion: Platform.Version?.toString() || undefined,
      },
    };

    await set(ref(db, `pushTokens/${deviceId}`), tokenData);
    console.log('✅ Token guardado en Firebase para deviceId:', deviceId);
  } catch (error) {
    console.error('❌ Error guardando token en Firebase:', error);
    throw error;
  }
};

/**
 * Actualiza la última actividad del dispositivo
 */
export const updateLastActive = async (): Promise<void> => {
  try {
    const deviceId = await getDeviceId();
    const db = getDatabase(getFirebaseApp());

    await set(ref(db, `pushTokens/${deviceId}/lastActive`), new Date().toISOString());
  } catch (error) {
    console.error('Error actualizando lastActive:', error);
  }
};

/**
 * Obtiene el historial de notificaciones desde Firebase
 *
 * Estructura en Firebase:
 * /notifications
 *   /{notificationId}
 *     id: "uuid-v4"
 *     title: "Título"
 *     body: "Descripción"
 *     icon: "https://..."
 *     imageUrl: "https://..." (opcional)
 *     actionButton: { ... } (opcional)
 *     createdAt: "2025-01-15T10:30:00.000Z"
 *     sentAt: "2025-01-15T10:35:00.000Z"
 *     category: "general"
 *     priority: "high"
 *     internalRoute: "/(tabs)/calendario" (opcional)
 *     data: { ... } (opcional)
 */
export const getNotificationsHistory = async (): Promise<NotificationData[]> => {
  try {
    const db = getDatabase(getFirebaseApp());
    const notificationsRef = ref(db, 'notifications');

    const snapshot = await get(notificationsRef);

    if (!snapshot.exists()) {
      return [];
    }

    const notificationsData = snapshot.val();
    const notifications: NotificationData[] = Object.values(notificationsData);

    // Ordenar por fecha de creación (más recientes primero)
    return notifications.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error('Error obteniendo historial de notificaciones:', error);
    return [];
  }
};

/**
 * Suscribirse a cambios en tiempo real del historial de notificaciones
 */
export const subscribeToNotifications = (
  callback: (notifications: NotificationData[]) => void
): (() => void) => {
  try {
    const db = getDatabase(getFirebaseApp());
    const notificationsRef = ref(db, 'notifications');

    const unsubscribe = onValue(notificationsRef, (snapshot) => {
      if (snapshot.exists()) {
        const notificationsData = snapshot.val();
        const notifications: NotificationData[] = Object.values(notificationsData);

        // Ordenar por fecha
        const sorted = notifications.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        callback(sorted);
      } else {
        callback([]);
      }
    });

    // Retornar función de cleanup
    return () => off(notificationsRef, 'value', unsubscribe);
  } catch (error) {
    console.error('Error suscribiéndose a notificaciones:', error);
    return () => {};
  }
};

/**
 * Guarda una notificación recibida en el historial local (AsyncStorage)
 * Esto permite que el usuario vea notificaciones incluso sin conexión
 */
export const saveReceivedNotificationLocally = async (
  notification: ReceivedNotification
): Promise<void> => {
  try {
    const existingData = await AsyncStorage.getItem(NOTIFICATIONS_HISTORY_KEY);
    const notifications: ReceivedNotification[] = existingData
      ? JSON.parse(existingData)
      : [];

    // Evitar duplicados
    const isDuplicate = notifications.some(n => n.id === notification.id);
    if (!isDuplicate) {
      notifications.unshift(notification); // Añadir al principio

      // Limitar a 100 notificaciones más recientes
      const limited = notifications.slice(0, 100);

      await AsyncStorage.setItem(NOTIFICATIONS_HISTORY_KEY, JSON.stringify(limited));
      console.log('📝 Notificación guardada localmente:', notification.title);
    }
  } catch (error) {
    console.error('Error guardando notificación localmente:', error);
  }
};

/**
 * Obtiene el historial local de notificaciones recibidas
 */
export const getLocalNotificationsHistory = async (): Promise<ReceivedNotification[]> => {
  try {
    const data = await AsyncStorage.getItem(NOTIFICATIONS_HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error obteniendo historial local:', error);
    return [];
  }
};

/**
 * Obtiene el conjunto de IDs de notificaciones leídas
 */
export const getReadNotificationIds = async (): Promise<Set<string>> => {
  try {
    const data = await AsyncStorage.getItem(READ_NOTIFICATIONS_KEY);
    return data ? new Set(JSON.parse(data)) : new Set();
  } catch (error) {
    console.error('Error obteniendo notificaciones leídas:', error);
    return new Set();
  }
};

/**
 * Marca una notificación como leída (tanto locales como de Firebase)
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    // Actualizar notificaciones locales si existe
    const data = await AsyncStorage.getItem(NOTIFICATIONS_HISTORY_KEY);
    if (data) {
    const notifications: ReceivedNotification[] = JSON.parse(data);
    const updated = notifications.map(n =>
      n.id === notificationId ? { ...n, isRead: true } : n
    );
      await AsyncStorage.setItem(NOTIFICATIONS_HISTORY_KEY, JSON.stringify(updated));
    }

    // Añadir a la lista de notificaciones leídas (para Firebase también)
    const readIds = await getReadNotificationIds();
    readIds.add(notificationId);
    await AsyncStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(Array.from(readIds)));
  } catch (error) {
    console.error('Error marcando notificación como leída:', error);
  }
};

/**
 * Cuenta las notificaciones sin leer
 * Combina notificaciones locales y de Firebase
 */
export const getUnreadNotificationsCount = async (): Promise<number> => {
  try {
    const readIds = await getReadNotificationIds();
    
    // Contar notificaciones locales sin leer
    const localNotifications = await getLocalNotificationsHistory();
    const unreadLocal = localNotifications.filter(n => !readIds.has(n.id) && !n.isRead);
    
    // Contar notificaciones de Firebase sin leer
    const firebaseNotifications = await getNotificationsHistory();
    const unreadFirebase = firebaseNotifications.filter(n => !readIds.has(n.id));
    
    // Eliminar duplicados por ID y contar
    const allUnreadIds = new Set([
      ...unreadLocal.map(n => n.id),
      ...unreadFirebase.map(n => n.id),
    ]);
    
    return allUnreadIds.size;
  } catch (error) {
    console.error('Error contando notificaciones sin leer:', error);
    return 0;
  }
};

/**
 * Limpia el historial local de notificaciones
 */
export const clearLocalNotifications = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(NOTIFICATIONS_HISTORY_KEY);
    console.log('🗑️ Historial local limpiado');
  } catch (error) {
    console.error('Error limpiando historial local:', error);
  }
};

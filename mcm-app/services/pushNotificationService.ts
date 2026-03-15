// services/pushNotificationService.ts
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  onValue,
  off,
} from 'firebase/database';
import { getFirebaseApp } from '@/hooks/firebaseApp';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  DeviceToken,
  NotificationData,
  ReceivedNotification,
} from '@/types/notifications';

const DEVICE_ID_KEY = '@mcm_device_id';
const PUSH_TOKEN_KEY = '@mcm_push_token';
const NOTIFICATIONS_HISTORY_KEY = '@mcm_notifications_history';
const READ_NOTIFICATIONS_KEY = '@mcm_read_notifications'; // IDs de notificaciones leídas (Firebase + locales)

// Token cacheado en memoria para acceso rápido desde updateLastActive
let cachedPushToken: string | null = null;

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
 * Cachea el token en memoria y AsyncStorage para que updateLastActive pueda usarlo
 */
export const cachePushToken = async (token: string): Promise<void> => {
  cachedPushToken = token;
  try {
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
  } catch (error) {
    console.error('Error cacheando token en AsyncStorage:', error);
  }
};

/**
 * Recupera el token cacheado (memoria > AsyncStorage)
 */
export const getCachedPushToken = async (): Promise<string | null> => {
  if (cachedPushToken) return cachedPushToken;
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (token) cachedPushToken = token;
    return token;
  } catch {
    return null;
  }
};

/**
 * Construye el objeto DeviceToken con los datos actuales del dispositivo.
 * IMPORTANTE: sanea explícitamente todos los valores para evitar `undefined`,
 * que Firebase RTDB rechaza silenciosamente con un error de serialización.
 */
const buildTokenData = (token: string): DeviceToken => {
  // Constants.deviceName está deprecado en SDK 50+, puede ser undefined
  const deviceName =
    (Constants.expoConfig as any)?.name ||
    (Constants as any)?.deviceName ||
    'Desconocido';

  const osVersion =
    (Platform.Version != null ? String(Platform.Version) : null) ||
    'Desconocida';

  const data: DeviceToken = {
    token: String(token),
    platform: Platform.OS as 'ios' | 'android' | 'web',
    registeredAt: new Date().toISOString(),
    lastActive: new Date().toISOString(),
    appVersion: String(Constants.expoConfig?.version || '1.0.0'),
    deviceInfo: {
      model: String(deviceName),
      osVersion: String(osVersion),
    },
  };

  // Eliminar cualquier campo undefined que Firebase no acepte
  return JSON.parse(JSON.stringify(data)) as DeviceToken;
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
    // Cachear el token primero (así updateLastActive lo tiene de fallback)
    await cachePushToken(token);

    const deviceId = await getDeviceId();
    const db = getDatabase(getFirebaseApp());
    const tokenData = buildTokenData(token);

    // Log de diagnóstico: mostrar exactamente qué se va a escribir
    console.log('📝 Intentando escribir en Firebase:', {
      path: `pushTokens/${deviceId}`,
      tokenData: JSON.stringify(tokenData),
    });

    await set(ref(db, `pushTokens/${deviceId}`), tokenData);
    console.log(
      '✅ Token guardado en Firebase para deviceId:',
      deviceId,
      'token:',
      token.substring(0, 30) + '...',
    );
  } catch (error: any) {
    // Log detallado para diagnosticar errores de Firebase (reglas, serialización, etc.)
    console.error('❌ Error guardando token en Firebase:');
    console.error('  message:', error?.message);
    console.error('  code:', error?.code);
    console.error('  stack:', error?.stack);
    throw error;
  }
};

/**
 * Actualiza la última actividad del dispositivo.
 * Si detecta que el token no está en Firebase, lo escribe también (fallback).
 */
export const updateLastActive = async (): Promise<void> => {
  try {
    const deviceId = await getDeviceId();
    const db = getDatabase(getFirebaseApp());
    const deviceRef = ref(db, `pushTokens/${deviceId}`);

    const token = await getCachedPushToken();

    if (token) {
      // Tenemos token en caché: verificar si ya está en Firebase
      const snapshot = await get(deviceRef);
      const existingData = snapshot.exists() ? snapshot.val() : null;

      if (!existingData?.token) {
        // El token no está en Firebase — escribir datos completos
        console.log(
          '🔄 Token no encontrado en Firebase, guardando datos completos...',
        );
        const tokenData = buildTokenData(token);
        // Preservar registeredAt original si existe
        if (existingData?.registeredAt) {
          tokenData.registeredAt = existingData.registeredAt;
        }
        await set(deviceRef, tokenData);
        console.log('✅ Token guardado en Firebase via heartbeat');
        return;
      }

      // El nodo existe con token: solo actualizar lastActive
      await update(deviceRef, {
        lastActive: new Date().toISOString(),
      });
    } else {
      // Sin token en caché: verificar si el nodo existe en Firebase con token
      // (puede pasar si se limpió la caché pero el registro existe)
      const snapshot = await get(deviceRef);
      const existingData = snapshot.exists() ? snapshot.val() : null;

      if (existingData?.token) {
        // El nodo existe y tiene token — solo actualizamos lastActive
        await update(deviceRef, {
          lastActive: new Date().toISOString(),
        });
      }
      // Si no hay token en caché NI en Firebase: no hacer nada.
      // Evitamos crear nodos "zombi" con solo lastActive.
    }
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
export const getNotificationsHistory = async (): Promise<
  NotificationData[]
> => {
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
    return notifications.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
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
  callback: (notifications: NotificationData[]) => void,
): (() => void) => {
  try {
    const db = getDatabase(getFirebaseApp());
    const notificationsRef = ref(db, 'notifications');

    const unsubscribe = onValue(notificationsRef, (snapshot) => {
      if (snapshot.exists()) {
        const notificationsData = snapshot.val();
        const notifications: NotificationData[] =
          Object.values(notificationsData);

        // Ordenar por fecha
        const sorted = notifications.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
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
  notification: ReceivedNotification,
): Promise<void> => {
  try {
    const existingData = await AsyncStorage.getItem(NOTIFICATIONS_HISTORY_KEY);
    const notifications: ReceivedNotification[] = existingData
      ? JSON.parse(existingData)
      : [];

    // Evitar duplicados
    const isDuplicate = notifications.some((n) => n.id === notification.id);
    if (!isDuplicate) {
      notifications.unshift(notification); // Añadir al principio

      // Limitar a 100 notificaciones más recientes
      const limited = notifications.slice(0, 100);

      await AsyncStorage.setItem(
        NOTIFICATIONS_HISTORY_KEY,
        JSON.stringify(limited),
      );
      console.log('📝 Notificación guardada localmente:', notification.title);
    }
  } catch (error) {
    console.error('Error guardando notificación localmente:', error);
  }
};

/**
 * Obtiene el historial local de notificaciones recibidas
 */
export const getLocalNotificationsHistory = async (): Promise<
  ReceivedNotification[]
> => {
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
export const markNotificationAsRead = async (
  notificationId: string,
): Promise<void> => {
  try {
    // Actualizar notificaciones locales si existe
    const data = await AsyncStorage.getItem(NOTIFICATIONS_HISTORY_KEY);
    if (data) {
      const notifications: ReceivedNotification[] = JSON.parse(data);
      const updated = notifications.map((n) =>
        n.id === notificationId ? { ...n, isRead: true } : n,
      );
      await AsyncStorage.setItem(
        NOTIFICATIONS_HISTORY_KEY,
        JSON.stringify(updated),
      );
    }

    // Añadir a la lista de notificaciones leídas (para Firebase también)
    const readIds = await getReadNotificationIds();
    readIds.add(notificationId);
    await AsyncStorage.setItem(
      READ_NOTIFICATIONS_KEY,
      JSON.stringify(Array.from(readIds)),
    );
  } catch (error) {
    console.error('Error marcando notificación como leída:', error);
  }
};

/**
 * Marca varias notificaciones como leídas a la vez
 */
export const markAllNotificationsAsRead = async (
  notificationIds: string[],
): Promise<void> => {
  try {
    // Actualizar notificaciones locales
    const data = await AsyncStorage.getItem(NOTIFICATIONS_HISTORY_KEY);
    if (data) {
      const notifications: ReceivedNotification[] = JSON.parse(data);
      const idsSet = new Set(notificationIds);
      const updated = notifications.map((n) =>
        idsSet.has(n.id) ? { ...n, isRead: true } : n,
      );
      await AsyncStorage.setItem(
        NOTIFICATIONS_HISTORY_KEY,
        JSON.stringify(updated),
      );
    }

    // Añadir todos a la lista de leídas
    const readIds = await getReadNotificationIds();
    notificationIds.forEach((id) => readIds.add(id));
    await AsyncStorage.setItem(
      READ_NOTIFICATIONS_KEY,
      JSON.stringify(Array.from(readIds)),
    );
  } catch (error) {
    console.error(
      'Error marcando todas las notificaciones como leídas:',
      error,
    );
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
    const unreadLocal = localNotifications.filter(
      (n) => !readIds.has(n.id) && !n.isRead,
    );

    // Contar notificaciones de Firebase sin leer
    const firebaseNotifications = await getNotificationsHistory();
    const unreadFirebase = firebaseNotifications.filter(
      (n) => !readIds.has(n.id),
    );

    // Eliminar duplicados por ID y contar
    const allUnreadIds = new Set([
      ...unreadLocal.map((n) => n.id),
      ...unreadFirebase.map((n) => n.id),
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

const NOTIFICATIONS_INITIALIZED_KEY = '@mcm_notifications_initialized';

/**
 * Inicialización de primer uso: marca como leídas las notificaciones históricas
 * para que un usuario nuevo no vea todo el historial como no leído.
 *
 * Regla: las 3 más recientes (dentro de los últimos 4 meses) permanecen no leídas.
 * El resto se marca como leídas automáticamente.
 *
 * Devuelve true si se ejecutó la inicialización (primera vez), false si ya se hizo.
 */
export const initializeNewUserReadStatus = async (
  notifications: NotificationData[],
): Promise<boolean> => {
  try {
    const initialized = await AsyncStorage.getItem(
      NOTIFICATIONS_INITIALIZED_KEY,
    );
    if (initialized) return false;

    // Marcar como inicializado antes de procesar (evita doble ejecución)
    await AsyncStorage.setItem(NOTIFICATIONS_INITIALIZED_KEY, 'true');

    const fourMonthsAgo = new Date();
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);

    // Notificaciones recientes (últimos 4 meses), ordenadas de más nueva a más antigua
    const recent = notifications
      .filter((n) => new Date(n.createdAt) > fourMonthsAgo)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    // Las 3 más recientes permanecen no leídas
    const keepUnreadIds = new Set(recent.slice(0, 3).map((n) => n.id));

    // Marcar como leídas todas las demás
    const toMarkRead = notifications
      .filter((n) => !keepUnreadIds.has(n.id))
      .map((n) => n.id);

    if (toMarkRead.length > 0) {
      await markAllNotificationsAsRead(toMarkRead);
      console.log(
        `📖 Primer uso: ${toMarkRead.length} notificaciones antiguas marcadas como leídas`,
      );
    }

    return true;
  } catch (error) {
    console.error('Error en inicialización de primer uso:', error);
    return false;
  }
};

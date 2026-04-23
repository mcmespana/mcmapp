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

export interface TokenProfileMetadata {
  profileType: 'familia' | 'monitor' | 'miembro' | null;
  delegationId: string | null;
  topics: string[];
}

/**
 * Construye el objeto DeviceToken con los datos actuales del dispositivo.
 * IMPORTANTE: sanea explícitamente todos los valores para evitar `undefined`,
 * que Firebase RTDB rechaza silenciosamente con un error de serialización.
 */
const buildTokenData = (
  token: string,
  profileMetadata?: TokenProfileMetadata,
): DeviceToken => {
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
    profileType: profileMetadata?.profileType ?? null,
    delegationId: profileMetadata?.delegationId ?? null,
    topics: profileMetadata?.topics ?? [],
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
export const saveTokenToFirebase = async (
  token: string,
  profileMetadata?: TokenProfileMetadata,
): Promise<void> => {
  try {
    // Cachear el token primero (así updateLastActive lo tiene de fallback)
    await cachePushToken(token);

    // Usar el propio token sanitizado como ID en Firebase en lugar de un deviceId aleatorio.
    // Esto evita que reinstalaciones dejen tokens "huerfanos" en la base de datos a los que
    // el backend seguiría enviando notificaciones (generando pushes duplicados en el mismo dispositivo).
    const safeTokenId = 'token_' + token.replace(/[^a-zA-Z0-9]/g, '_');
    const db = getDatabase(getFirebaseApp());
    const tokenData = buildTokenData(token, profileMetadata);

    // Log de diagnóstico: mostrar exactamente qué se va a escribir
    console.log('📝 Intentando escribir en Firebase:', {
      path: `pushTokens/${safeTokenId}`,
      tokenData: JSON.stringify(tokenData),
    });

    await set(ref(db, `pushTokens/${safeTokenId}`), tokenData);
    console.log(
      '✅ Token guardado en Firebase para safeTokenId:',
      safeTokenId,
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
export const updateLastActive = async (
  profileMetadata?: TokenProfileMetadata,
): Promise<void> => {
  try {
    const db = getDatabase(getFirebaseApp());
    const token = await getCachedPushToken();

    if (token) {
      const safeTokenId = 'token_' + token.replace(/[^a-zA-Z0-9]/g, '_');
      const deviceRef = ref(db, `pushTokens/${safeTokenId}`);
      // Tenemos token en caché: verificar si ya está en Firebase
      const snapshot = await get(deviceRef);
      const existingData = snapshot.exists() ? snapshot.val() : null;

      if (!existingData?.token) {
        // El token no está en Firebase — escribir datos completos
        console.log(
          '🔄 Token no encontrado en Firebase, guardando datos completos...',
        );
        const tokenData = buildTokenData(token, profileMetadata);
        // Preservar registeredAt original si existe
        if (existingData?.registeredAt) {
          tokenData.registeredAt = existingData.registeredAt;
        }
        await set(deviceRef, tokenData);
        console.log('✅ Token guardado en Firebase via heartbeat');
        return;
      }

      // El nodo existe con token: actualizar lastActive y la metadata del perfil
      // si se proporcionó (cambios de perfil/delegación se propagan aquí).
      const updates: Record<string, unknown> = {
        lastActive: new Date().toISOString(),
      };
      if (profileMetadata) {
        updates.profileType = profileMetadata.profileType ?? null;
        updates.delegationId = profileMetadata.delegationId ?? null;
        updates.topics = profileMetadata.topics ?? [];
      }
      await update(deviceRef, updates);
    } else {
      // Sin token en caché: no podemos determinar el nodo en Firebase.
      // No hacer nada — evita crear nodos "zombi" con solo lastActive.
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

    // Evitar duplicados por ID o por contenido (título + cuerpo) si llegaron casi al mismo tiempo
    const isDuplicate = notifications.some((n) => {
      // Dedup por ID explícito del backend (no IDs locales generados)
      if (n.id === notification.id) return true;
      // Dedup por contenido — ventana de 5 minutos (captura entregas duplicadas casi simultáneas)
      if (n.title === notification.title && n.body === notification.body) {
        const timeA = new Date(n.receivedAt).getTime();
        const timeB = new Date(notification.receivedAt).getTime();
        if (Math.abs(timeA - timeB) < 5 * 60 * 1000) {
          return true;
        }
      }
      return false;
    });

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

      // Encontrar la notificación para obtener su contenido
      const target = notifications.find((n) => n.id === notificationId);

      const updated = notifications.map((n) => {
        // Marcar por ID exacto
        if (n.id === notificationId) return { ...n, isRead: true };
        // También marcar por contenido idéntico (cubre IDs inconsistentes entre fuentes)
        if (target && n.title === target.title && n.body === target.body) {
          return { ...n, isRead: true };
        }
        return n;
      });
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

      // Buscar el contenido de las notificaciones a marcar para poder
      // también marcar sus equivalentes con ID diferente.
      const contentKeys = new Set<string>();
      for (const notif of notifications) {
        if (idsSet.has(notif.id)) {
          contentKeys.add(`${notif.title}|${notif.body}`);
        }
      }

      const updated = notifications.map((n) => {
        if (idsSet.has(n.id)) return { ...n, isRead: true };
        // También marcar por contenido idéntico
        if (contentKeys.has(`${n.title}|${n.body}`))
          return { ...n, isRead: true };
        return n;
      });
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

/**
 * Verifica si una notificación tiene más de 60 días
 */
export const isNotificationOlderThan60Days = (dateStr?: string): boolean => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays > 60;
};

export const getUnreadNotificationsCount = async (): Promise<number> => {
  try {
    const readIds = await getReadNotificationIds();
    const localNotifications = await getLocalNotificationsHistory();
    const firebaseNotifications = await getNotificationsHistory();

    // Combinar, priorizando locales
    const combined = [...localNotifications, ...firebaseNotifications].sort(
      (a, b) => {
        const dateA = new Date('receivedAt' in a ? a.receivedAt : a.createdAt);
        const dateB = new Date('receivedAt' in b ? b.receivedAt : b.createdAt);
        return dateB.getTime() - dateA.getTime();
      },
    );

    // Deduplicar
    const seenContentKeys = new Set<string>();
    const seenIds = new Set<string>();
    const deduplicated = combined.filter((n) => {
      const contentKey = `${n.title}|${n.body}`;
      if (seenContentKeys.has(contentKey)) return false;
      if (n.id && seenIds.has(n.id)) return false;
      seenContentKeys.add(contentKey);
      if (n.id) seenIds.add(n.id);
      return true;
    });

    const isNotificationRead = (n: any) => {
      if (readIds.has(n.id)) return true;
      if ('isRead' in n && n.isRead) return true;
      const dateStr = 'receivedAt' in n ? n.receivedAt : n.createdAt;
      if (isNotificationOlderThan60Days(dateStr)) return true;
      return false;
    };

    return deduplicated.filter((n) => !isNotificationRead(n)).length;
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

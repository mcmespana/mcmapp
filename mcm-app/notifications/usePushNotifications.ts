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
import { useEffect, useMemo, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import {
  saveTokenToFirebase,
  cachePushToken,
  updateLastActive,
  saveReceivedNotificationLocally,
  markNotificationAsRead,
  type TokenProfileMetadata,
} from '@/services/pushNotificationService';
import { ReceivedNotification } from '@/types/notifications';
import {
  normalizeNotificationRoute,
  extractActionButton,
  extractActionButtons,
} from '@/utils/notificationRoutes';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useEventSubscriptions } from '@/contexts/EventSubscriptionsContext';
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
function getStableNotificationId(
  content: Notifications.NotificationContent,
): string {
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
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return `local_${Math.abs(hash).toString(36)}`;
}

// Mapeo de actionIdentifier de iOS a rutas internas.
// Los valores se pasan por `normalizeNotificationRoute` antes de navegar, así
// que basta con que apunten a una ruta real (p. ej. el centro de notificaciones
// es `/notifications`, no `/(tabs)/notifications`).
const ACTION_ROUTES: Record<string, string> = {
  view: '/notifications',
  view_event: '/(tabs)/calendario',
  view_photos: '/(tabs)/fotos',
};

// Metadata más reciente conocida del perfil. Se mantiene a nivel de módulo
// para que `tryRegisterPushToken()` (invocado desde el banner de permisos)
// pueda registrar el token con los topics correctos sin tener que pasar
// la metadata como argumento.
let latestMetadata: TokenProfileMetadata | null = null;

/**
 * Intenta registrar el token push usando la metadata de perfil más reciente
 * conocida por el hook. Es idempotente y seguro de llamar desde cualquier
 * punto: si los permisos no están concedidos, devuelve sin error.
 *
 * Pensado para el flujo del banner de permisos: tras conceder los permisos
 * (in-app prompt o vuelta desde Ajustes), se llama esta función para que el
 * token quede registrado sin esperar al siguiente arranque de la app.
 */
export async function tryRegisterPushToken(): Promise<void> {
  await registerAndSaveToken(latestMetadata);
}

export default function usePushNotifications() {
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const { refreshCount } = useNotifications();

  const resolved = useResolvedProfileConfig();
  const { profile } = useUserProfile();
  const { eventTopics } = useEventSubscriptions();

  // Metadata para segmentación en Firebase. Solo la construimos cuando el
  // usuario ya tiene perfil/delegación definidos (post onboarding). Antes,
  // pasamos `null` para marcar "todavía sin clasificar".
  //
  // `topics` = topics del perfil/delegación + topics `event-<id>` de las
  // suscripciones opt-in a eventos (deduplicados). Así un mismo token recibe
  // tanto los envíos segmentados por perfil como los de los eventos a los que
  // se haya apuntado.
  const profileMetadata = useMemo<TokenProfileMetadata>(
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

  // Mantener una referencia mutable para que los efectos puedan leer el valor
  // más reciente sin recrearse (evita duplicar listeners y reescribir el token).
  const metadataRef = useRef(profileMetadata);
  const didRegisterRef = useRef(false);
  useEffect(() => {
    metadataRef.current = profileMetadata;
    // Espejo a nivel de módulo para `tryRegisterPushToken()`.
    latestMetadata = profileMetadata;
    // Propaga cambios de perfil/delegación/suscripciones a eventos al token
    // de Firebase de inmediato (sin esperar al heartbeat de 5 min). En el
    // primer render el token aún no está cacheado: `updateLastActive` es un
    // no-op seguro y el registro inicial (efecto de abajo) hace la escritura.
    if (didRegisterRef.current) {
      updateLastActive(metadataRef.current).catch(() => {});
    }
  }, [profileMetadata]);

  useEffect(() => {
    // Registrar token y guardar en Firebase, luego heartbeat inicial
    registerAndSaveToken(metadataRef.current).then(() => {
      didRegisterRef.current = true;
      updateLastActive(metadataRef.current).catch(() => {});
    });

    // Actualizar última actividad periódicamente (cada 5 minutos)
    const intervalId = setInterval(
      () => {
        updateLastActive(metadataRef.current).catch(() => {});
      },
      5 * 60 * 1000,
    );

    // Listener para notificaciones recibidas (app en foreground)
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        const notificationId = getStableNotificationId(
          notification.request.content,
        );
        const receivedNotification: ReceivedNotification = {
          id: notificationId,
          title: notification.request.content.title || 'Notificación',
          body: notification.request.content.body || '',
          bodyLong: notification.request.content.data?.bodyLong as
            | string
            | undefined,
          icon: notification.request.content.data?.icon as string | undefined,
          imageUrl: notification.request.content.data?.imageUrl as
            | string
            | undefined,
          actionButton: extractActionButton(notification.request.content.data),
          actionButtons: extractActionButtons(
            notification.request.content.data,
          ),
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

        // ID estable de la notificación (lo necesitamos también para el
        // deep-link al centro de notificaciones).
        const notificationId = getStableNotificationId(
          response.notification.request.content,
        );

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

        // 3. Por defecto (sin ruta específica): abrir el centro de
        //    notificaciones mostrando esta notificación en grande.
        if (!targetRoute) {
          targetRoute = '/notifications';
        }

        const normalized = normalizeNotificationRoute(targetRoute);
        try {
          // Si vamos al centro de notificaciones, hacemos deep-link a ESTA
          // notificación concreta para abrir su detalle (vista "en grande").
          if (normalized === '/notifications') {
            router.navigate({
              pathname: '/notifications',
              params: { openId: notificationId },
            } as any);
          } else {
            router.navigate(normalized as any);
          }
        } catch {}

        // Guardar y marcar como leída
        const receivedNotification: ReceivedNotification = {
          id: notificationId,
          title: response.notification.request.content.title || 'Notificación',
          body: response.notification.request.content.body || '',
          bodyLong: data?.bodyLong as string | undefined,
          icon: data?.icon as string | undefined,
          imageUrl: data?.imageUrl as string | undefined,
          actionButton: extractActionButton(data),
          actionButtons: extractActionButtons(data),
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

  // Cuando cambie el perfil/delegación después del onboarding, re-publica la
  // metadata en Firebase (updateLastActive con metadata hace merge). Esto es
  // barato y mantiene segmentación actualizada.
  useEffect(() => {
    updateLastActive(profileMetadata).catch(() => {});
  }, [profileMetadata]);

  // Al volver al foreground, reintenta el registro. Cubre el caso de
  // "vuelvo de Ajustes tras conceder permisos": `registerAndSaveToken`
  // es idempotente (no-op si los permisos siguen denegados, refresca
  // token y guarda en Firebase si pasaron a granted).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        registerAndSaveToken(metadataRef.current).catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);
}

/**
 * Flujo completo: permisos → token → guardar en Firebase
 * Con logging detallado para diagnosticar problemas
 */
async function registerAndSaveToken(
  profileMetadata: TokenProfileMetadata | null,
) {
  if (Platform.OS === 'web') return;

  try {
    // 1. Permisos
    // Cast to any: TS no resuelve `expo-modules-core` (anidado bajo expo/) y
    // por eso no ve los campos heredados de PermissionResponse (`status`,
    // `granted`...). En runtime sí existen.
    const existing = (await Notifications.getPermissionsAsync()) as any;
    let granted: boolean = !!existing.granted;

    if (!granted) {
      const requested = (await Notifications.requestPermissionsAsync()) as any;
      granted = !!requested.granted;
    }

    if (!granted) {
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
    await saveTokenToFirebase(token, profileMetadata ?? undefined);
  } catch {}
}

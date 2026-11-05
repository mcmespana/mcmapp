// notifications/NotificationHandler.ts
import { logger } from '@/utils/logger';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { isContigoReminderData } from '@/utils/contigoReminders';

/**
 * Configura cómo se manejan las notificaciones cuando la app está en foreground
 *
 * - shouldPlaySound: Reproduce sonido
 * - shouldSetBadge: Actualiza el badge/contador de notificaciones (iOS)
 * - shouldShowAlert: Muestra la alerta/banner (iOS)
 * - shouldShowBanner: Muestra el banner (Android)
 * - shouldShowList: Añade a la lista de notificaciones
 */
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Recordatorios de Contigo: son LOCALES, así que no hay duplicado que
    // evitar (eso solo pasa con los push del Panel). Si la app está abierta y
    // aún no has hecho el hábito, el aviso se ve igual que fuera de la app.
    if (isContigoReminderData(notification.request.content.data)) {
      return {
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    }

    // ── Foreground: NO mostrar banner/alert/list del sistema ──
    // La notificación se gestiona internamente por el listener
    // `notificationReceived` de usePushNotifications (la guarda en AsyncStorage
    // y actualiza el badge). Mostrar también via el sistema nativo causa
    // duplicados/triplicados en el centro de notificaciones de iOS.
    //
    // Solo reproducimos sonido y actualizamos badge del icono de la app.
    return {
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowAlert: false,
      shouldShowBanner: false,
      shouldShowList: false,
    };
  },
});

/**
 * Configuración de categorías de notificaciones (para acciones)
 * Esto permite añadir botones a las notificaciones en iOS
 */
if (Platform.OS === 'ios') {
  Notifications.setNotificationCategoryAsync('general', [
    {
      identifier: 'view',
      buttonTitle: 'Ver',
      options: {
        opensAppToForeground: true,
      },
    },
  ]).catch((err) => logger.error('Error configurando categorías:', err));

  Notifications.setNotificationCategoryAsync('eventos', [
    {
      identifier: 'view_event',
      buttonTitle: 'Ver Evento',
      options: {
        opensAppToForeground: true,
      },
    },
  ]).catch((err) => logger.error('Error configurando categorías:', err));

  Notifications.setNotificationCategoryAsync('fotos', [
    {
      identifier: 'view_photos',
      buttonTitle: 'Ver Fotos',
      options: {
        opensAppToForeground: true,
      },
    },
  ]).catch((err) => logger.error('Error configurando categorías:', err));
}

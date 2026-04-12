// notifications/NotificationHandler.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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
    // Puedes personalizar el comportamiento basado en la categoría
    const category = notification.request.content.data?.category as
      | string
      | undefined;
    const priority = notification.request.content.data?.priority as
      | string
      | undefined;

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
  ]).catch((err) => console.error('Error configurando categorías:', err));

  Notifications.setNotificationCategoryAsync('eventos', [
    {
      identifier: 'view_event',
      buttonTitle: 'Ver Evento',
      options: {
        opensAppToForeground: true,
      },
    },
  ]).catch((err) => console.error('Error configurando categorías:', err));

  Notifications.setNotificationCategoryAsync('fotos', [
    {
      identifier: 'view_photos',
      buttonTitle: 'Ver Fotos',
      options: {
        opensAppToForeground: true,
      },
    },
  ]).catch((err) => console.error('Error configurando categorías:', err));
}

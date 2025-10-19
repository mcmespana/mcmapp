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
    const category = notification.request.content.data?.category as string | undefined;
    const priority = notification.request.content.data?.priority as string | undefined;

    // Notificaciones urgentes siempre suenan y se muestran
    if (category === 'urgente' || priority === 'high') {
      return {
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    }

    // Notificaciones normales
    return {
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowAlert: Platform.OS === 'ios',
      shouldShowBanner: Platform.OS === 'android',
      shouldShowList: true,
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
  ]).catch(err => console.error('Error configurando categorías:', err));

  Notifications.setNotificationCategoryAsync('eventos', [
    {
      identifier: 'view_event',
      buttonTitle: 'Ver Evento',
      options: {
        opensAppToForeground: true,
      },
    },
  ]).catch(err => console.error('Error configurando categorías:', err));

  Notifications.setNotificationCategoryAsync('fotos', [
    {
      identifier: 'view_photos',
      buttonTitle: 'Ver Fotos',
      options: {
        opensAppToForeground: true,
      },
    },
  ]).catch(err => console.error('Error configurando categorías:', err));
}

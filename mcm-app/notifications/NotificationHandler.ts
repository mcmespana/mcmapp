// notifications/NotificationHandler.ts
import * as Notifications from 'expo-notifications';

// Cada vez que entra una notificación, mostramos una alerta
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

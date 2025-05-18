// notifications/NotificationHandler.ts
import * as Notifications from 'expo-notifications';



// Cada vez que entra una notificación, mostramos una alerta
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

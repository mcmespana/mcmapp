// notifications/usePushNotifications.ts
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

export default function usePushNotifications() {
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    // 1. Registrarnos y pedir permisos
    registerForPushNotificationsAsync().then(token => {
      console.log('Expo Push Token:', token);
      // Aquí podrías enviarlo a tu backend si quisieras
    });

    // 2. Listener cuando llega notificación en foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notificación recibida:', notification);
    });

    // 3. Listener cuando el usuario interactúa con la notificación
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Usuario tocó notificación:', response);
    });

    // 4. Cleanup al desmontar
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);
}

// Función auxiliar para pedir permisos y obtener token Expo
async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Constants.isDevice) {
    alert('Debes usar un dispositivo o emulador con Google Play Services');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    alert('¡Sin permisos para notificaciones!');
    return null;
  }

  // Obtenemos token Expo
  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  // Configuración de canal para Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#253883',
    });
  }

  return token;
}

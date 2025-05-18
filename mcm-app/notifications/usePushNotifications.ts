// notifications/usePushNotifications.ts
import { useEffect, useRef } from 'react';
import { Alert, Platform, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

export default function usePushNotifications() {
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    // 1️⃣ Pedir permiso de notifs
    askNotificationPermission()
      .then(status => {
        if (status as unknown as Notifications.PermissionStatus === Notifications.PermissionStatus.GRANTED) {
          // 2️⃣ Si ok, registra canal y token
          registerForPushNotificationsAsync().then(token => {
            console.log('🥳 Expo Push Token:', token);
          });
        }
      })
      .catch(console.error);

    // 3️⃣ Listeners
    notificationListener.current = Notifications.addNotificationReceivedListener(n => {
      console.log('🔔 Notificación recibida:', n);
    });
    responseListener.current = Notifications.addNotificationResponseReceivedListener(r => {
      console.log('📲 Usuario tocó notificación:', r);
    });

    // 4️⃣ Cleanup
    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);
}

/** Pide permisos y, si el usuario lo deniega, le abre Ajustes */
async function askNotificationPermission(): Promise<Notifications.NotificationPermissionsStatus> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== Notifications.PermissionStatus.GRANTED) {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== Notifications.PermissionStatus.GRANTED) {
    // iOS y Android 13+: se muestra diálogo; Android ≤12 no
    Alert.alert(
      'Necesitamos notificaciones 🔔',
      'Activa las notificaciones en los ajustes de la app',
      [
        { text: 'Abrir Ajustes', onPress: () => Linking.openSettings() },
        { text: 'Cancelar', style: 'cancel' }
      ]
    );
  }
  return finalStatus as unknown as Notifications.NotificationPermissionsStatus;
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Crea canal Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#253883',
    });
  }
  // Token sólo en dispositivo real
  if (Constants.isDevice) {
    const { data } = await Notifications.getExpoPushTokenAsync();
    return data;
  }
  return null;
}

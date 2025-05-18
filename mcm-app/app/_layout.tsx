// app/_layout.tsx

// Importamos el manejador de notificaciones
import '../notifications/NotificationHandler';   // 1️⃣ inicializa el handler
import usePushNotifications from '../notifications/usePushNotifications'; // 2️⃣ nuestro hook

import {OneSignal, LogLevel} from 'react-native-onesignal';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATIONS_STORAGE_KEY = 'bf78779e-4d63-444f-a72e-ce5e0fb2bf80'; 


import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/hooks/useColorScheme';



export default function RootLayout() {

  usePushNotifications(); // 3️⃣ inicializa el hook



 // Del histórico de notificaciones - lo de antes es lo original
    useEffect(() => {
  // Configuración de OneSignal - ELIMINAR DEBUG PRODUCCIÓN
  OneSignal.Debug.setLogLevel(LogLevel.Verbose);   
  OneSignal.initialize('bf78779e-4d63-444f-a72e-ce5e0fb2bf80');
  OneSignal.Notifications.requestPermission(false);
    // Listener para cuando la app está en primer plano y se va a mostrar una notificación
    const foregroundWillDisplayHandler = async (event: any) => {
      console.log("OneSignal: foregroundWillDisplay global:", event);
      const newNotification = {
        id: event.notification.notificationId || new Date().toISOString(),
        title: event.notification.title,
        body: event.notification.body,
        receivedDate: new Date().toISOString(),
        // additionalData: event.notification.additionalData
      };

      try {
        const existingNotifications = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
        const notifications = existingNotifications ? JSON.parse(existingNotifications) : [];
        const updatedNotifications = [newNotification, ...notifications];
        await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updatedNotifications));
        console.log("Notificación guardada en AsyncStorage desde foregroundWillDisplay");
      } catch (e) {
        console.error("Error guardando notificación en AsyncStorage:", e);
      }
      
      // Para que la notificación se muestre mientras la app está abierta
      event.preventDefault(); // Previene la visualización por defecto de OneSignal
      event.notification.display(); // Muestra la notificación manualmente
    };
    OneSignal.Notifications.addEventListener("foregroundWillDisplay", foregroundWillDisplayHandler);


    // Listener para cuando se hace clic en una notificación (app cerrada/segundo plano y se abre)
     const clickHandler = async (event: any) => {
      console.log("OneSignal: notification clicked global:", event);
      const clickedNotification = {
        id: event.notification.notificationId || new Date().toISOString(),
        title: event.notification.title,
        body: event.notification.body,
        receivedDate: new Date().toISOString(),
        // additionalData: event.notification.additionalData
      };
      try {
        const existingNotifications = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
        let notifications = existingNotifications ? JSON.parse(existingNotifications) : [];
        // Evitar duplicados
        if (!notifications.find((n: any) => n.id === clickedNotification.id)) {
          notifications = [clickedNotification, ...notifications];
          await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
          console.log("Notificación (click) guardada en AsyncStorage");
        }
      } catch (e) {
        console.error("Error guardando notificación (click) en AsyncStorage:", e);
      }
      // Aquí puedes añadir lógica para navegar a una pantalla específica basada en additionalData
    };
    OneSignal.Notifications.addEventListener("click", clickHandler);


    // Cleanup (importante para evitar leaks de memoria)
    // La forma de remover listeners puede variar con la versión de react-native-onesignal.
    // Consulta su documentación oficial para la versión que estés usando.
    // return () => {
    //   OneSignal.Notifications.removeEventListener("foregroundWillDisplay", foregroundWillDisplayHandler);
    //   OneSignal.Notifications.removeEventListener("click", clickHandler);
    // };
  }, []);

  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider value={theme}>
      <Slot />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
function useEffect(arg0: () => void, arg1: never[]) {
  throw new Error('Function not implemented.');
}


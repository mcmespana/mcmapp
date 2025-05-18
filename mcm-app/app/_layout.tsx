// app/_layout.tsx

// Importamos el manejador de notificaciones
import '../notifications/NotificationHandler';   // 1️⃣ inicializa el handler
import usePushNotifications from '../notifications/usePushNotifications'; // 2️⃣ nuestro hook

import {OneSignal, LogLevel} from 'react-native-onesignal';


import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/hooks/useColorScheme';



export default function RootLayout() {

  usePushNotifications(); // 3️⃣ inicializa el hook

  // Configuración de OneSignal - ELIMINAR DEBUG PRODUCCIÓN
  OneSignal.Debug.setLogLevel(LogLevel.Verbose);   
  OneSignal.initialize('bf78779e-4d63-444f-a72e-ce5e0fb2bf80');
  OneSignal.Notifications.requestPermission(false);

  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider value={theme}>
      <Slot />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

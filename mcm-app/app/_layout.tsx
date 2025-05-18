// app/_layout.tsx
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/hooks/useColorScheme';

// Importamos el manejador de notificaciones
import '../notifications/NotificationHandler';   // 1️⃣ inicializa el handler
import usePushNotifications from '../notifications/usePushNotifications'; // 2️⃣ nuestro hook


export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider value={theme}>
      <Slot />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

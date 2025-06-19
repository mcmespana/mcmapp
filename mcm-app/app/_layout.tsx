// app/_layout.tsx

// NOTIS - Se queda en el branch notificaciones
/*
import '../notifications/NotificationHandler';   // 1️⃣ inicializa el handler
import usePushNotifications from '../notifications/usePushNotifications'; // 2️⃣ nuestro hook

import {OneSignal, LogLevel} from 'react-native-onesignal';
import AsyncStorage from '@react-native-async-storage/async-storage'; *

 const NOTIFICATIONS_STORAGE_KEY = 'bf78779e-4d63-444f-a72e-ce5e0fb2bf80';  */


import React, { useState, useEffect, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, StyleSheet } from 'react-native';
import { ThemeProvider as NavThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/hooks/useColorScheme';
import { AppSettingsProvider } from '@/contexts/AppSettingsContext';
import { HelloWave } from '@/components/HelloWave'; // Import HelloWave
import { Provider as PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import colors from '@/constants/colors';



export default function RootLayout() {
  return (
    <AppSettingsProvider>
      <InnerLayout />
    </AppSettingsProvider>
  );
}

function InnerLayout() {
  const [showAnimation, setShowAnimation] = useState(true);
  const scheme = useColorScheme(); // Keep existing hooks
  
  // Configuración del tema de Paper
  const paperTheme = useMemo(() => {
    const base = scheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
    return { ...base, colors: { ...base.colors, primary: colors.success } };
  }, [scheme]);
  
  // Configuración del tema de navegación
  const navigationTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  useEffect(() => {
    // The HelloWave animation repeats 4 times, each sequence is 150ms + 150ms = 300ms.
    // Total animation time = 4 * 300ms = 1200ms.
    // Let's give it a bit more, say 1500ms (1.5 seconds), before hiding.
    const timer = setTimeout(() => {
      setShowAnimation(false);
    }, 1500); // Adjust timing as needed

    return () => clearTimeout(timer); // Cleanup timer on unmount
  }, []);

  // NOTIS - Comentado para eliminar sistema notificaciones
  //usePushNotifications(); // 3️⃣ inicializa el hook


   // useEffect(() => {
  // Configuración de OneSignal - ELIMINAR DEBUG PRODUCCIÓN
  /* NOTIS - SEe queda en el branch notificaciones 
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

    */
  
    // sigue use effect después de notificaciones
  
 // }, []);

  if (showAnimation) {
    return (
      <View style={styles.animationContainer}>
        <HelloWave />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={paperTheme}>
        <NavThemeProvider value={navigationTheme}>
          <Slot />
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        </NavThemeProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

// Add a StyleSheet for the animation container
const styles = StyleSheet.create({
  animationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff', // Or use a theme color
  },
});


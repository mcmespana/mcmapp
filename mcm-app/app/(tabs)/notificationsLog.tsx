// app/(tabs)/notificationsLog.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';
import { OneSignal } from 'react-native-onesignal'; // Importa OneSignal

import colors from '@/constants/colors';
import typography from '@/constants/typography';
import spacing from '@/constants/spacing';

// Define la estructura esperada de una notificación para tipado
interface StoredNotification {
  id: string; // O el identificador que OneSignal provea
  title?: string | null; // El título puede ser nulo
  body?: string | null;  // El cuerpo puede ser nulo
  receivedDate: string; // Fecha en la que se recibió
  // Puedes añadir más campos de OneSignal si los necesitas
}

const NOTIFICATIONS_STORAGE_KEY = '@AppNotificationsLog';

export default function NotificationsLogScreen() {
  const [notifications, setNotifications] = useState<StoredNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar notificaciones almacenadas al montar la pantalla
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const storedNotifications = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
        if (storedNotifications) {
          setNotifications(JSON.parse(storedNotifications));
        }
      } catch (error) {
        console.error("Error cargando notificaciones:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadNotifications();
  }, []);

  // Escuchar nuevas notificaciones de OneSignal y actualizar el log y AsyncStorage
  useEffect(() => {
    // Listener para cuando la app está en primer plano
    OneSignal.Notifications.addEventListener("foregroundWillDisplay", (event) => {
      console.log("OneSignal: foregroundWillDisplay:", event);
      const newNotification: StoredNotification = {
        id: event.notification.notificationId || new Date().toISOString(), // Usa ID de OneSignal o fallback
        title: event.notification.title,
        body: event.notification.body,
        receivedDate: new Date().toISOString(),
        // Puedes extraer más datos de event.notification.additionalData si los envías
      };
      
      setNotifications(prevNotifications => {
        const updatedNotifications = [newNotification, ...prevNotifications];
        AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updatedNotifications))
          .catch(err => console.error("Error guardando notificación en AsyncStorage:", err));
        return updatedNotifications;
      });
    });

    // Listener para notificaciones recibidas (app en segundo plano o cerrada y se abre por la notif)
    // OneSignal ya gestiona la visualización, aquí solo actualizamos el log si es necesario
    // o podrías usar addEventListener("click", event => { ... }) para cuando se toca una
    OneSignal.Notifications.addEventListener("click", (event) => {
      console.log("OneSignal: notification clicked:", event);
      // Similar al foreground, podrías querer añadirla si no se añadió antes
      // o simplemente navegar a una parte específica de la app
      // Es importante evitar duplicados si ya la procesaste en 'foregroundWillDisplay'
      // o si OneSignal la añade automáticamente al log que maneja internamente.
      // Para este ejemplo, asumimos que queremos loguear todas las interacciones o recepciones.
      const clickedNotification: StoredNotification = {
        id: event.notification.notificationId || new Date().toISOString(),
        title: event.notification.title,
        body: event.notification.body,
        receivedDate: new Date().toISOString(),
      };

      setNotifications(prevNotifications => {
        // Evitar duplicados si ya existe por ID
        if (prevNotifications.find(n => n.id === clickedNotification.id)) {
          return prevNotifications;
        }
        const updatedNotifications = [clickedNotification, ...prevNotifications];
        AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updatedNotifications))
          .catch(err => console.error("Error guardando notificación (click) en AsyncStorage:", err));
        return updatedNotifications;
      });

    });


    // No olvides remover los listeners al desmontar el componente
    return () => {
      // OneSignal.Notifications.removeEventListener("foregroundWillDisplay");
      // OneSignal.Notifications.removeEventListener("click");
      // Nota: la nueva SDK de OneSignal podría no tener `removeEventListener` y gestionar
      // la limpieza de otra manera o automáticamente. Revisa la documentación de `react-native-onesignal`.
    };
  }, []);


  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando notificaciones...</Text>
      </View>
    );
  }

  if (notifications.length === 0) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Notificaciones' }} />
        <Text style={styles.emptyText}>Aún no hay notificaciones.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Notificaciones' }} />
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.notificationItem}>
            <Text style={styles.notificationTitle}>{item.title || "Notificación"}</Text>
            {item.body && <Text style={styles.notificationBody}>{item.body}</Text>}
            <Text style={styles.notificationDate}>
              Recibido: {new Date(item.receivedDate).toLocaleString()}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  loadingText: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.lg,
    color: colors.text,
  },
  emptyText: {
    ...typography.h2,
    textAlign: 'center',
    marginTop: spacing.lg,
    color: colors.text,
    fontWeight: 'bold',
  },
  notificationItem: {
    backgroundColor: Platform.OS === 'ios' ? '#f9f9f9' : '#ffffff', // Ligeramente diferente para iOS
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: "#000", // Sombra para Android
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3, // Sombra para Android
  },
  notificationTitle: {
    ...typography.h2,
    fontSize: 16, // Ajustar según sea necesario
    fontWeight: 'bold',
    color: colors.primary,
  },
  notificationBody: {
    ...typography.body,
    fontSize: 14, // Ajustar según sea necesario
    color: colors.text,
    marginTop: spacing.xs,
  },
  notificationDate: {
    ...typography.caption,
    fontSize: 12, // Ajustar según sea necesario
    color: colors.secondary, // Un color más suave para la fecha
    marginTop: spacing.sm,
    textAlign: 'right',
  },
});
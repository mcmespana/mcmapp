import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import {
  getNotificationsHistory,
  getLocalNotificationsHistory,
  markNotificationAsRead,
} from '@/services/pushNotificationService';
import { NotificationData, ReceivedNotification } from '@/types/notifications';

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const scheme = useColorScheme();
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);

  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [localNotifications, setLocalNotifications] = useState<ReceivedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = async () => {
    try {
      // Cargar desde Firebase (historial completo del panel admin)
      const firebaseNotifs = await getNotificationsHistory();
      setNotifications(firebaseNotifs);

      // Cargar historial local (notificaciones recibidas en este dispositivo)
      const localNotifs = await getLocalNotificationsHistory();
      setLocalNotifications(localNotifs);
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const handleNotificationPress = async (notification: NotificationData | ReceivedNotification) => {
    // Marcar como leída si es local
    if ('isRead' in notification && !notification.isRead) {
      await markNotificationAsRead(notification.id);
      loadNotifications();
    }

    // Navegar si tiene ruta interna
    if (notification.internalRoute) {
      try {
        router.push(notification.internalRoute as any);
      } catch (error) {
        console.error('Error navegando:', error);
      }
    }
    // Abrir URL externa si tiene botón de acción
    else if (notification.actionButton && !notification.actionButton.isInternal) {
      Linking.openURL(notification.actionButton.url).catch(err =>
        console.error('Error abriendo URL:', err)
      );
    }
  };

  const renderNotification = (notification: NotificationData | ReceivedNotification, index: number) => {
    const isUnread = 'isRead' in notification && !notification.isRead;
    const date = new Date('receivedAt' in notification ? notification.receivedAt : notification.createdAt);

    return (
      <TouchableOpacity
        key={notification.id}
        style={[styles.notificationCard, isUnread && styles.unreadCard]}
        onPress={() => handleNotificationPress(notification)}
      >
        {notification.icon && (
          <Image source={{ uri: notification.icon }} style={styles.notificationIcon} />
        )}

        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text style={styles.notificationTitle}>{notification.title}</Text>
            {isUnread && <View style={styles.unreadBadge} />}
          </View>

          <Text style={styles.notificationBody} numberOfLines={3}>
            {notification.body}
          </Text>

          <Text style={styles.notificationDate}>
            {formatDate(date)}
          </Text>

          {notification.actionButton && (
            <View style={styles.actionButtonContainer}>
              <Text style={styles.actionButtonText}>
                {notification.actionButton.text}
              </Text>
              <MaterialIcons
                name={notification.actionButton.isInternal ? 'arrow-forward' : 'open-in-new'}
                size={16}
                color={colors.primary}
              />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Combinar y ordenar notificaciones
  const allNotifications = [...localNotifications, ...notifications]
    .sort((a, b) => {
      const dateA = new Date('receivedAt' in a ? a.receivedAt : a.createdAt);
      const dateB = new Date('receivedAt' in b ? b.receivedAt : b.createdAt);
      return dateB.getTime() - dateA.getTime();
    })
    // Eliminar duplicados por ID
    .filter((notification, index, self) =>
      index === self.findIndex(n => n.id === notification.id)
    );

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: Colors[scheme ?? 'light'].background },
      ]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={Colors[scheme ?? 'light'].text}
          />
        </TouchableOpacity>
        <Text style={styles.title}>Notificaciones</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Cargando...</Text>
          </View>
        ) : allNotifications.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons
              name="notifications-none"
              size={64}
              color={Colors[scheme ?? 'light'].icon}
            />
            <Text style={styles.emptyTitle}>No hay notificaciones</Text>
            <Text style={styles.emptyText}>
              Aquí aparecerán tus notificaciones cuando las tengas. ¡Vuelve más tarde!
            </Text>
          </View>
        ) : (
          <View style={styles.notificationsList}>
            {allNotifications.map((notification, index) =>
              renderNotification(notification, index)
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  if (hours < 24) return `Hace ${hours} h`;
  if (days < 7) return `Hace ${days} d`;

  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

const createStyles = (scheme: 'light' | 'dark') => {
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: theme.background,
    },
    backButton: {
      marginRight: spacing.md,
    },
    headerRight: {
      width: 32,
    },
    title: {
      ...(typography.h1 as any),
      fontSize: 18,
      flex: 1,
      textAlign: 'center',
      color: theme.text,
    },
    content: {
      flexGrow: 1,
      padding: spacing.md,
    },
    emptyState: {
      alignItems: 'center',
      padding: spacing.xl,
      marginTop: spacing.xl,
    },
    emptyTitle: {
      ...(typography.h2 as any),
      fontSize: 16,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
      textAlign: 'center',
      color: theme.text,
    },
    emptyText: {
      ...(typography.body as any),
      textAlign: 'center',
      color: theme.icon,
      lineHeight: 22,
    },
    notificationsList: {
      paddingVertical: spacing.sm,
    },
    notificationCard: {
      flexDirection: 'row',
      backgroundColor: theme.background,
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    unreadCard: {
      backgroundColor: scheme === 'dark' ? '#1a1a2e' : '#f0f4ff',
      borderColor: colors.primary,
    },
    notificationIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      marginRight: spacing.md,
      backgroundColor: colors.border,
    },
    notificationContent: {
      flex: 1,
    },
    notificationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    notificationTitle: {
      ...(typography.h2 as any),
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      flex: 1,
    },
    unreadBadge: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginLeft: spacing.xs,
    },
    notificationBody: {
      ...(typography.body as any),
      fontSize: 14,
      color: theme.icon,
      marginBottom: spacing.xs,
      lineHeight: 20,
    },
    notificationDate: {
      ...(typography.caption as any),
      fontSize: 12,
      color: theme.icon,
      marginBottom: spacing.xs,
    },
    actionButtonContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    actionButtonText: {
      ...(typography.body as any),
      fontSize: 14,
      color: colors.primary,
      fontWeight: '600',
      marginRight: spacing.xs,
    },
  });
};

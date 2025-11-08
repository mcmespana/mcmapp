import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  Linking,
  RefreshControl,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import {
  getNotificationsHistory,
  getLocalNotificationsHistory,
  markNotificationAsRead,
  getReadNotificationIds,
} from '@/services/pushNotificationService';
import { NotificationData, ReceivedNotification } from '@/types/notifications';
import useUnreadNotificationsCount from '@/hooks/useUnreadNotificationsCount';

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const scheme = useColorScheme();
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const { refresh: refreshUnreadCount } = useUnreadNotificationsCount();

  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [localNotifications, setLocalNotifications] = useState<ReceivedNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
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

      // Cargar IDs de notificaciones leídas
      const readNotificationIds = await getReadNotificationIds();
      setReadIds(readNotificationIds);
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

  // Refrescar cuando la pantalla recibe foco (para actualizar el contador)
  useFocusEffect(
    React.useCallback(() => {
      loadNotifications();
      refreshUnreadCount();
    }, [refreshUnreadCount])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const handleMarkAsRead = async (notificationId: string) => {
    await markNotificationAsRead(notificationId);
    await loadNotifications();
    refreshUnreadCount();
  };

  const handleNotificationPress = async (notification: NotificationData | ReceivedNotification) => {
    // Marcar como leída si no está leída
    const isRead = readIds.has(notification.id) || ('isRead' in notification && notification.isRead);
    if (!isRead) {
      await handleMarkAsRead(notification.id);
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

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
    notificationId: string
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
      <TouchableOpacity
        style={styles.rightAction}
        onPress={() => handleMarkAsRead(notificationId)}
      >
        <Animated.View style={[styles.actionContent, { transform: [{ scale }] }]}>
          <MaterialIcons name="check" size={24} color="#fff" />
          <Text style={styles.actionText}>Leída</Text>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderNotification = ({ item: notification, index }: { item: NotificationData | ReceivedNotification; index: number }) => {
    // Determinar si está leída: verificar en readIds o en la propiedad isRead local
    const isRead = readIds.has(notification.id) || ('isRead' in notification && notification.isRead);
    const isUnread = !isRead;
    const date = new Date('receivedAt' in notification ? notification.receivedAt : notification.createdAt);

    return (
      <Swipeable
        renderRightActions={(progress, dragX) =>
          isUnread ? renderRightActions(progress, dragX, notification.id) : null
        }
        rightThreshold={40}
        overshootRight={false}
      >
        <TouchableOpacity
          style={[styles.notificationCard, isUnread && styles.unreadCard]}
          onPress={() => handleNotificationPress(notification)}
          activeOpacity={0.7}
        >
          {notification.icon && (
            <Image source={{ uri: notification.icon }} style={styles.notificationIcon} />
          )}

          <View style={styles.notificationContent}>
            <View style={styles.notificationHeader}>
              <Text style={styles.notificationTitle}>{notification.title}</Text>
              <View style={styles.notificationHeaderRight}>
                {isUnread && <View style={styles.unreadBadge} />}
                {isUnread && (
                  <TouchableOpacity
                    style={styles.markAsReadButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleMarkAsRead(notification.id);
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <MaterialIcons name="check-circle-outline" size={20} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
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
      </Swipeable>
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
        <FlatList
          data={allNotifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}
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
      padding: spacing.md,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
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
    notificationHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    notificationTitle: {
      ...(typography.h2 as any),
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      flex: 1,
      marginRight: spacing.xs,
    },
    unreadBadge: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    markAsReadButton: {
      padding: 4,
    },
    rightAction: {
      backgroundColor: colors.success,
      justifyContent: 'center',
      alignItems: 'flex-end',
      borderRadius: 12,
      marginBottom: spacing.md,
      paddingRight: spacing.md,
      minWidth: 100,
    },
    actionContent: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionText: {
      color: '#fff',
      fontWeight: '600',
      marginTop: 4,
      fontSize: 12,
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

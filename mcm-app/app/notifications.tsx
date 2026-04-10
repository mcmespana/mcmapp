import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  FlatList,
  Image,
  Linking,
  RefreshControl,
  Animated,
  ScrollView,
} from 'react-native';
import { BottomSheet, Button, Chip } from 'heroui-native';
// IMPORTANTE: usar TouchableOpacity de gesture-handler (no de RN core)
// dentro de Swipeable para que los toques anidados funcionen correctamente.
import {
  TouchableOpacity,
  Swipeable,
} from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import colors, { Colors } from '@/constants/colors';
import { hexAlpha } from '@/utils/colorUtils';
import { useColorScheme } from '@/hooks/useColorScheme';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import {
  getLocalNotificationsHistory,
  markNotificationAsRead,
  getReadNotificationIds,
  markAllNotificationsAsRead,
  initializeNewUserReadStatus,
} from '@/services/pushNotificationService';
import { NotificationData, ReceivedNotification } from '@/types/notifications';
import { useNotifications } from '@/contexts/NotificationsContext';

// Mapeo de rutas internas a nombres legibles
const ROUTE_LABELS: Record<string, { label: string; icon: string }> = {
  '/(tabs)/calendario': { label: 'Calendario', icon: 'calendar-today' },
  '/(tabs)/fotos': { label: 'Fotos', icon: 'photo-library' },
  '/(tabs)/cancionero': { label: 'Cantoral', icon: 'music-note' },
  '/(tabs)/mas': { label: 'Más', icon: 'more-horiz' },
  '/(tabs)/index': { label: 'Inicio', icon: 'home' },
  '/wordle': { label: 'Wordle', icon: 'games' },
  '/notifications': { label: 'Notificaciones', icon: 'notifications' },
};

function getRouteLabel(
  route: string,
): { label: string; icon: string } | null {
  return ROUTE_LABELS[route] ?? null;
}

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const scheme = useColorScheme();
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const { firebaseNotifications, refreshCount } = useNotifications();

  const [localNotifications, setLocalNotifications] = useState<
    ReceivedNotification[]
  >([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<
    (NotificationData | ReceivedNotification) | null
  >(null);

  const loadLocalData = useCallback(async () => {
    try {
      const localNotifs = await getLocalNotificationsHistory();
      setLocalNotifications(localNotifs);
      const readNotificationIds = await getReadNotificationIds();
      setReadIds(new Set(readNotificationIds));
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLocalData();
      refreshCount();
    }, [loadLocalData, refreshCount]),
  );

  // Primer uso: auto-marcar notificaciones históricas como leídas
  useEffect(() => {
    if (firebaseNotifications.length === 0) return;
    initializeNewUserReadStatus(firebaseNotifications).then((didInit) => {
      if (didInit) {
        loadLocalData();
        refreshCount();
      }
    });
  }, [firebaseNotifications, loadLocalData, refreshCount]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadLocalData();
  };

  const handleMarkAsRead = useCallback(
    async (notificationId: string) => {
      await markNotificationAsRead(notificationId);
      await loadLocalData();
      refreshCount();
    },
    [loadLocalData, refreshCount],
  );

  const handleMarkAllAsRead = async () => {
    const unreadIds = allNotifications
      .filter((n) => !readIds.has(n.id) && !('isRead' in n && n.isRead))
      .map((n) => n.id);
    if (unreadIds.length === 0) return;
    await markAllNotificationsAsRead(unreadIds);
    await loadLocalData();
    refreshCount();
  };

  const handleNotificationPress = useCallback(
    async (notification: NotificationData | ReceivedNotification) => {
      const isRead =
        readIds.has(notification.id) ||
        ('isRead' in notification && notification.isRead);
      if (!isRead) {
        await handleMarkAsRead(notification.id);
      }
      setSelectedNotification(notification);
    },
    [readIds, handleMarkAsRead],
  );

  const handleActionButtonPress = useCallback(
    (
      notification: NotificationData | ReceivedNotification,
      e: any,
    ) => {
      // Prevenir que el tap llegue al card padre
      if (e?.stopPropagation) e.stopPropagation();
      const isRead =
        readIds.has(notification.id) ||
        ('isRead' in notification && notification.isRead);
      if (!isRead) {
        handleMarkAsRead(notification.id).catch((err) =>
          console.error('Error marcando como leída:', err),
        );
      }
      if (!notification.actionButton) return;
      if (notification.actionButton.isInternal) {
        try {
          router.push(notification.actionButton.url as any);
        } catch (error) {
          console.error('Error navegando:', error);
        }
      } else {
        Linking.openURL(notification.actionButton.url).catch((err) =>
          console.error('Error abriendo URL:', err),
        );
      }
    },
    [readIds, handleMarkAsRead],
  );

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
    notificationId: string,
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
        accessibilityLabel="Marcar como leída"
        accessibilityRole="button"
      >
        <Animated.View
          style={[styles.actionContent, { transform: [{ scale }] }]}
        >
          <MaterialIcons name="check" size={24} color="#fff" />
          <Text style={styles.actionText}>Leída</Text>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderNotification = ({
    item: notification,
  }: {
    item: NotificationData | ReceivedNotification;
  }) => {
    const isRead =
      readIds.has(notification.id) ||
      ('isRead' in notification && notification.isRead);
    const isUnread = !isRead;
    const date = new Date(
      'receivedAt' in notification
        ? notification.receivedAt
        : notification.createdAt,
    );
    const routeInfo = notification.internalRoute
      ? getRouteLabel(notification.internalRoute)
      : null;

    return (
      <Swipeable
        renderRightActions={(progress, dragX) =>
          isUnread ? renderRightActions(progress, dragX, notification.id) : null
        }
        rightThreshold={40}
        overshootRight={false}
      >
        {/* TouchableOpacity de gesture-handler para evitar conflictos dentro de Swipeable */}
        <TouchableOpacity
          style={[styles.notificationCard, isUnread && styles.unreadCard]}
          onPress={() => handleNotificationPress(notification)}
          activeOpacity={0.7}
          accessibilityLabel={`${isUnread ? 'No leída: ' : ''}${notification.title}`}
          accessibilityRole="button"
        >
          {notification.icon && (
            <Image
              source={{ uri: notification.icon }}
              style={styles.notificationIcon}
              accessibilityLabel="Icono de notificación"
            />
          )}

          <View style={styles.notificationContent}>
            {/* Cabecera: título + indicadores */}
            <View style={styles.notificationHeader}>
              <Text
                style={[
                  styles.notificationTitle,
                  !isUnread && styles.notificationTitleRead,
                ]}
                numberOfLines={1}
              >
                {notification.title}
              </Text>
              <View style={styles.notificationHeaderRight}>
                {isUnread && <View style={styles.unreadBadge} />}
                {/* Botón marcar como leída — TouchableOpacity de gesture-handler */}
                {isUnread && (
                  <TouchableOpacity
                    style={styles.markAsReadButton}
                    onPress={() => handleMarkAsRead(notification.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel="Marcar como leída"
                    accessibilityRole="button"
                  >
                    <MaterialIcons
                      name="check-circle-outline"
                      size={20}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Cuerpo */}
            <Text style={styles.notificationBody} numberOfLines={2}>
              {notification.body}
            </Text>

            {/* Fila inferior: fecha + chips de destino/acción */}
            <View style={styles.notificationFooter}>
              <Text style={styles.notificationDate}>{formatDate(date)}</Text>
              <View style={styles.chipsRow}>
                {/* Chip de destino interno */}
                {routeInfo && (
                  <View style={styles.destinationChip}>
                    <Text style={styles.destinationChipText}>
                      {routeInfo.label}
                    </Text>
                  </View>
                )}
                {/* Chip de botón de acción (tappable — navega directamente) */}
                {notification.actionButton && (
                  <TouchableOpacity
                    style={styles.actionChip}
                    onPress={(e?) => handleActionButtonPress(notification, e)}
                    accessibilityLabel={notification.actionButton.text}
                    accessibilityRole="button"
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text style={styles.actionChipText} numberOfLines={1}>
                      {notification.actionButton.text}
                    </Text>
                    <MaterialIcons
                      name={
                        notification.actionButton.isInternal
                          ? 'arrow-forward'
                          : 'open-in-new'
                      }
                      size={11}
                      color="#fff"
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  // Combinar Firebase (real-time) + locales, deduplicar, ordenar
  const allNotifications = React.useMemo(() => {
    const combined = [...localNotifications, ...firebaseNotifications].sort(
      (a, b) => {
        const dateA = new Date('receivedAt' in a ? a.receivedAt : a.createdAt);
        const dateB = new Date('receivedAt' in b ? b.receivedAt : b.createdAt);
        return dateB.getTime() - dateA.getTime();
      },
    );

    const seenIds = new Set<string>();
    return combined.filter((notification) => {
      if (!notification.id) return true; // sin ID: siempre incluir
      if (seenIds.has(notification.id)) return false;
      seenIds.add(notification.id);
      return true;
    });
  }, [localNotifications, firebaseNotifications]);

  const hasUnread = allNotifications.some(
    (n) => !readIds.has(n.id) && !('isRead' in n && n.isRead),
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
          accessibilityLabel="Volver"
          accessibilityRole="button"
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={Colors[scheme ?? 'light'].text}
          />
        </TouchableOpacity>
        <Text style={styles.title}>Notificaciones</Text>
        {hasUnread ? (
          <TouchableOpacity
            onPress={handleMarkAllAsRead}
            style={styles.markAllButton}
            accessibilityLabel="Marcar todas como leídas"
            accessibilityRole="button"
          >
            <MaterialIcons name="done-all" size={22} color={colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerRight} />
        )}
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
            Aquí aparecerán tus notificaciones cuando las tengas.
          </Text>
        </View>
      ) : (
        <FlatList
          data={allNotifications}
          keyExtractor={(item, index) =>
            item.id ? item.id.toString() : `fallback-${index}`
          }
          renderItem={renderNotification}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}

      {/* Modal de detalle de notificación */}
      <NotificationDetailModal
        notification={selectedNotification}
        onClose={() => setSelectedNotification(null)}
        scheme={scheme}
      />
    </SafeAreaView>
  );
}

// ============================================================================
// Notification Detail Modal
// ============================================================================

function NotificationDetailModal({
  notification,
  onClose,
  scheme,
}: {
  notification: (NotificationData | ReceivedNotification) | null;
  onClose: () => void;
  scheme: 'light' | 'dark';
}) {
  const theme = Colors[scheme ?? 'light'];
  const date = notification ? new Date(
    'receivedAt' in notification
      ? notification.receivedAt
      : notification.createdAt,
  ) : new Date();
  const routeInfo = notification?.internalRoute
    ? getRouteLabel(notification.internalRoute)
    : null;

  const handleInternalRoute = () => {
    if (!notification) return;
    onClose();
    try {
      router.push(notification.internalRoute as any);
    } catch (error) {
      console.error('Error navegando:', error);
    }
  };

  const handleActionButton = () => {
    if (!notification?.actionButton) return;
    if (notification.actionButton.isInternal) {
      onClose();
      try {
        router.push(notification.actionButton.url as any);
      } catch (error) {
        console.error('Error navegando:', error);
      }
    } else {
      Linking.openURL(notification.actionButton.url).catch((err) =>
        console.error('Error abriendo URL:', err),
      );
    }
  };

  return (
    <BottomSheet
      isOpen={!!notification}
      onOpenChange={(open) => { if (!open) onClose(); }}
    >
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content>
          <ScrollView
            contentContainerStyle={dStyles.content}
            showsVerticalScrollIndicator={false}
          >
            {notification && (
            <>
            {/* Icono */}
            {notification.icon && (
              <Image source={{ uri: notification.icon }} style={dStyles.icon} />
            )}

            {/* Título */}
            <BottomSheet.Title style={[dStyles.title, { color: theme.text }]}>
              {notification.title}
            </BottomSheet.Title>

            {/* Fecha */}
            <Text style={[dStyles.date, { color: theme.icon }]}>
              {date.toLocaleDateString('es-ES', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>

            {/* Imagen grande */}
            {notification.imageUrl && (
              <Image
                source={{ uri: notification.imageUrl }}
                style={dStyles.image}
                resizeMode="cover"
              />
            )}

            {/* Cuerpo */}
            <Text style={[dStyles.body, { color: theme.text }]}>
              {notification.body}
            </Text>

            {/* Separador si hay acciones */}
            {(routeInfo || notification.actionButton) && (
              <View
                style={[dStyles.divider, { backgroundColor: hexAlpha(theme.icon, '30') }]}
              />
            )}

            {/* Botón de destino interno (internalRoute) */}
            {routeInfo && (
              <Button
                variant="outline"
                onPress={handleInternalRoute}
                style={[dStyles.routeButton, { borderColor: colors.primary }]}
              >
                <MaterialIcons
                  name={routeInfo.icon as any}
                  size={20}
                  color={colors.primary}
                />
                <Button.Label style={{ color: colors.primary, flex: 1 }}>
                  Ir a {routeInfo.label}
                </Button.Label>
                <MaterialIcons
                  name="arrow-forward-ios"
                  size={14}
                  color={colors.primary}
                />
              </Button>
            )}

            {/* Botón de acción CTA */}
            {notification.actionButton && (
              <Button
                variant="primary"
                onPress={handleActionButton}
                style={dStyles.actionButton}
              >
                <Button.Label style={dStyles.actionButtonText}>
                  {notification.actionButton.text}
                </Button.Label>
                <MaterialIcons
                  name={
                    notification.actionButton.isInternal
                      ? 'arrow-forward'
                      : 'open-in-new'
                  }
                  size={18}
                  color="#fff"
                />
              </Button>
            )}
            </>
            )}
          </ScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

const dStyles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,  // 64/2 — circle
    marginBottom: spacing.md,
    alignSelf: 'center',
  },
  title: { fontSize: 22, fontWeight: '700', marginBottom: spacing.sm },
  date: { fontSize: 13, marginBottom: spacing.lg, textTransform: 'capitalize' },
  image: {
    width: '100%',
    height: 200,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
  },
  body: { fontSize: 16, lineHeight: 26, marginBottom: spacing.lg },
  divider: {
    height: 1,
    marginBottom: spacing.lg,
  },
  routeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: radii.md,
    borderWidth: 1.5,
    marginBottom: spacing.md,
  },
  routeButtonText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: radii.lg,
    gap: 10,
    ...shadows.lg,
    shadowColor: colors.primary,
  },
  actionButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});

// ============================================================================
// Helpers & Styles
// ============================================================================

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
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: theme.background,
    },
    backButton: { marginRight: spacing.md },
    headerRight: { width: 32 },
    markAllButton: { padding: 4 },
    title: {
      ...(typography.h1 as any),
      fontSize: 18,
      flex: 1,
      textAlign: 'center',
      color: theme.text,
    },
    content: { padding: spacing.md },
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
      borderRadius: radii.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },
    unreadCard: {
      backgroundColor: scheme === 'dark' ? '#1a1a2e' : '#f0f4ff',
      borderColor: colors.primary,
    },
    notificationIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      marginRight: spacing.md,
      backgroundColor: colors.border,
      alignSelf: 'flex-start',
      marginTop: 2,
    },
    notificationContent: { flex: 1 },
    notificationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    notificationHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
    },
    notificationTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
      flex: 1,
      marginRight: spacing.xs,
    },
    notificationTitleRead: {
      fontWeight: '500',
    },
    unreadBadge: {
      width: 8,
      height: 8,
      borderRadius: radii.xs,
      backgroundColor: colors.primary,
    },
    markAsReadButton: { padding: 2 },
    rightAction: {
      backgroundColor: colors.success,
      justifyContent: 'center',
      alignItems: 'flex-end',
      borderRadius: radii.md,
      marginBottom: spacing.md,
      paddingRight: spacing.md,
      minWidth: 90,
    },
    actionContent: { alignItems: 'center', justifyContent: 'center' },
    actionText: {
      color: '#fff',
      fontWeight: '600',
      marginTop: 4,
      fontSize: 12,
    },
    notificationBody: {
      fontSize: 13,
      color: theme.icon,
      lineHeight: 19,
      marginBottom: 8,
    },
    notificationFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 6,
    },
    notificationDate: {
      fontSize: 11,
      color: theme.icon,
    },
    chipsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 1,
      flexWrap: 'wrap',
    },
    destinationChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingVertical: 3,
      paddingHorizontal: 7,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: hexAlpha(colors.primary, '60'),
      backgroundColor: hexAlpha(colors.primary, '12'),
    },
    destinationChipText: {
      fontSize: 10,
      color: colors.primary,
      fontWeight: '600',
    },
    actionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
      maxWidth: 140,
    },
    actionChipText: {
      fontSize: 10,
      color: '#fff',
      fontWeight: '600',
      flexShrink: 1,
    },
  });
};

import { logger } from '@/utils/logger';
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  FlatList,
  Linking,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import colors, { Colors } from '@/constants/colors';
import { hexAlpha } from '@/utils/colorUtils';
import { useColorScheme } from '@/hooks/useColorScheme';
import spacing from '@/constants/spacing';
import { radii } from '@/constants/uiStyles';
import {
  getLocalNotificationsHistory,
  markNotificationAsRead,
  getReadNotificationIds,
  markAllNotificationsAsRead,
  initializeNewUserReadStatus,
  isNotificationOlderThan60Days,
} from '@/services/pushNotificationService';
import { NotificationData, ReceivedNotification } from '@/types/notifications';
import { useNotifications } from '@/contexts/NotificationsContext';
import BottomSheet from './BottomSheet';
import NotificationDetail from './notifications/NotificationDetail';
import NotificationListItem from './notifications/NotificationListItem';
import { normalizeRoute } from './notifications/notificationDisplay';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_GAP = 80; // space below safe-area (notch / Dynamic Island)

type Notification = NotificationData | ReceivedNotification;
type ActionButton = NonNullable<Notification['actionButton']>;

interface Props {
  visible: boolean;
  onClose: () => void;
  /**
   * Si se pasa, al abrir el sheet se muestra directamente el detalle de esta
   * notificación (vista "en grande") en lugar de la lista. Lo usa la tarjeta de
   * Novedades de la Home para abrir la última notificación concreta.
   */
  initialNotification?: Notification | null;
}

export default function NotificationsBottomSheet({
  visible,
  onClose,
  initialNotification = null,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const theme = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { firebaseNotifications, refreshCount } = useNotifications();

  const [localNotifications, setLocalNotifications] = useState<
    ReceivedNotification[]
  >([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNotification, setSelectedNotification] =
    useState<Notification | null>(null);

  // Al abrir: si viene una notificación inicial, mostramos su detalle en grande
  // (y la marcamos como leída). Al cerrar: reseteamos la vista de detalle.
  useEffect(() => {
    if (visible) {
      setSelectedNotification(initialNotification ?? null);
      if (initialNotification) {
        markNotificationAsRead(initialNotification.id)
          .then(() => {
            loadLocalData();
            refreshCount();
          })
          .catch(() => {});
      }
    } else {
      setSelectedNotification(null);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (visible) {
      loadLocalData();
      refreshCount();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Datos ──────────────────────────────────────────────────────────────────
  const loadLocalData = useCallback(async () => {
    try {
      const localNotifs = await getLocalNotificationsHistory();
      setLocalNotifications(localNotifs);
      const ids = await getReadNotificationIds();
      setReadIds(new Set(ids));
    } catch (e) {
      logger.error('Error cargando notificaciones:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (firebaseNotifications.length === 0) return;
    initializeNewUserReadStatus(firebaseNotifications).then((didInit) => {
      if (didInit) {
        loadLocalData();
        refreshCount();
      }
    });
  }, [firebaseNotifications, loadLocalData, refreshCount]);

  // Combinar local + Firebase, deduplicar por contenido, ordenar
  const allNotifications = React.useMemo(() => {
    const combined = [...localNotifications, ...firebaseNotifications].sort(
      (a, b) => {
        const dA = new Date('receivedAt' in a ? a.receivedAt : a.createdAt);
        const dB = new Date('receivedAt' in b ? b.receivedAt : b.createdAt);
        return dB.getTime() - dA.getTime();
      },
    );

    const seenContentKeys = new Set<string>();
    const seenIds = new Set<string>();
    return combined.filter((n) => {
      const contentKey = `${n.title}|${n.body}`;
      if (seenContentKeys.has(contentKey)) return false;
      if (n.id && seenIds.has(n.id)) return false;
      seenContentKeys.add(contentKey);
      if (n.id) seenIds.add(n.id);
      return true;
    });
  }, [localNotifications, firebaseNotifications]);

  const isNotificationRead = React.useCallback(
    (n: Notification) => {
      if (readIds.has(n.id)) return true;
      if ('isRead' in n && n.isRead) return true;
      const dateStr = 'receivedAt' in n ? n.receivedAt : n.createdAt;
      if (isNotificationOlderThan60Days(dateStr)) return true;
      return false;
    },
    [readIds],
  );

  const hasUnread = allNotifications.some((n) => !isNotificationRead(n));

  const handleMarkAsRead = useCallback(
    async (id: string) => {
      await markNotificationAsRead(id);
      await loadLocalData();
      refreshCount();
    },
    [loadLocalData, refreshCount],
  );

  const handleMarkAllAsRead = async () => {
    const unreadIds = allNotifications
      .filter((n) => !isNotificationRead(n))
      .map((n) => n.id);
    if (!unreadIds.length) return;
    await markAllNotificationsAsRead(unreadIds);
    await loadLocalData();
    refreshCount();
  };

  const handleNotificationPress = useCallback(
    async (notification: Notification) => {
      if (!isNotificationRead(notification))
        await handleMarkAsRead(notification.id);
      setSelectedNotification(notification);
    },
    [isNotificationRead, handleMarkAsRead],
  );

  const handleDestinationChipPress = useCallback(
    (route: string) => {
      onClose();
      const clean = normalizeRoute(route);
      setTimeout(() => {
        try {
          router.push(clean as any);
        } catch (e) {
          logger.error('Error navegando:', e);
        }
      }, 320);
    },
    [onClose],
  );

  const handleActionButtonPress = useCallback(
    (btn: ActionButton) => {
      onClose();
      setTimeout(() => {
        if (btn.isInternal) {
          try {
            router.push(normalizeRoute(btn.url) as any);
          } catch {}
        } else {
          Linking.openURL(btn.url).catch(logger.error);
        }
      }, 320);
    },
    [onClose],
  );

  const renderNotification = ({ item }: { item: Notification }) => (
    <NotificationListItem
      notification={item}
      isRead={isNotificationRead(item)}
      theme={theme}
      isDark={isDark}
      scheme={scheme}
      onPress={handleNotificationPress}
      onMarkRead={handleMarkAsRead}
      onDestinationPress={handleDestinationChipPress}
      onActionPress={handleActionButtonPress}
    />
  );

  // Fixed height so FlatList can scroll: leave SHEET_GAP below Dynamic Island
  const sheetHeight = SCREEN_HEIGHT - (insets.top + SHEET_GAP);

  const headerLeft = selectedNotification ? (
    <TouchableOpacity
      onPress={() => setSelectedNotification(null)}
      style={{ padding: 4 }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <MaterialIcons name="arrow-back" size={24} color={theme.text} />
    </TouchableOpacity>
  ) : undefined;

  const headerRight =
    !selectedNotification && hasUnread ? (
      <TouchableOpacity
        onPress={handleMarkAllAsRead}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={sheetStyles.markAllHeaderBtn}
      >
        <MaterialIcons name="done-all" size={18} color={colors.primary} />
        <Text style={sheetStyles.markAllHeaderText}>Marcar todo</Text>
      </TouchableOpacity>
    ) : undefined;

  // En el detalle NO repetimos el título en el header del sheet: la vista de
  // detalle ya muestra el título en grande, así que duplicarlo arriba sobra
  // (solo dejamos la flecha de volver). En la lista mostramos "Notificaciones".
  const sheetTitle = selectedNotification ? undefined : 'Notificaciones';

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      height={sheetHeight}
      title={sheetTitle}
      headerLeft={headerLeft}
      headerRight={headerRight}
      dragFromContent={true}
    >
      {selectedNotification ? (
        <NotificationDetail
          notification={selectedNotification}
          onClose={onClose}
          scheme={scheme}
          bottomInset={insets.bottom}
        />
      ) : (
        <>
          {loading ? (
            <View style={sheetStyles.empty}>
              <Text style={[sheetStyles.emptyText, { color: theme.icon }]}>
                Cargando…
              </Text>
            </View>
          ) : allNotifications.length === 0 ? (
            <View style={sheetStyles.empty}>
              <MaterialIcons
                name="notifications-none"
                size={64}
                color={theme.icon}
              />
              <Text style={[sheetStyles.emptyTitle, { color: theme.text }]}>
                No hay notificaciones
              </Text>
              <Text style={[sheetStyles.emptyText, { color: theme.icon }]}>
                Aquí aparecerán tus notificaciones cuando las tengas.
              </Text>
            </View>
          ) : (
            <FlatList
              data={allNotifications}
              keyExtractor={(item, idx) =>
                item.id ? item.id.toString() : `fb-${idx}`
              }
              renderItem={renderNotification}
              contentContainerStyle={[
                sheetStyles.listContent,
                { paddingBottom: insets.bottom + spacing.md },
              ]}
              scrollEventThrottle={16}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true);
                    loadLocalData();
                  }}
                />
              }
            />
          )}
        </>
      )}
    </BottomSheet>
  );
}

const sheetStyles = StyleSheet.create({
  listContent: {
    padding: spacing.md,
  },
  markAllHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: hexAlpha(colors.primary, '10'),
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.md,
  },
  markAllHeaderText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.7,
  },
});

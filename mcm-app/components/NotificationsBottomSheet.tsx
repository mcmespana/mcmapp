import { logger } from '@/utils/logger';
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
  Pressable,
  Dimensions,
} from 'react-native';
import { TouchableOpacity, Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import colors, { Colors } from '@/constants/colors';
import { hexAlpha } from '@/utils/colorUtils';
import { useColorScheme } from '@/hooks/useColorScheme';
import spacing from '@/constants/spacing';
import { radii, shadows } from '@/constants/uiStyles';
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

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_GAP = 80; // space below safe-area (notch / Dynamic Island)

const ROUTE_LABELS: Record<
  string,
  { label: string; icon: keyof typeof MaterialIcons.glyphMap }
> = {
  '/(tabs)/calendario': { label: 'Calendario', icon: 'calendar-today' },
  '/(tabs)/fotos': { label: 'Fotos', icon: 'photo-library' },
  '/(tabs)/cancionero': { label: 'Cantoral', icon: 'music-note' },
  '/(tabs)/mas': { label: 'Más', icon: 'more-horiz' },
  '/(tabs)/index': { label: 'Inicio', icon: 'home' },
  '/wordle': { label: 'Wordle', icon: 'games' },
  '/(tabs)/contigo': { label: 'Contigo', icon: 'favorite' },
  '/(tabs)/contigo/evangelio': { label: 'Evangelio', icon: 'menu-book' },
  '/(tabs)/contigo/oracion': { label: 'Oración', icon: 'brightness-3' },
  '/(tabs)/contigo/revision': { label: 'Revisión', icon: 'rate-review' },
  '/(tabs)/contigo/bookmarks': { label: 'Favoritos', icon: 'bookmark' },
};

function normalizeRoute(route: string): string {
  if (!route) return '';
  let clean = route.trim();
  if (clean.startsWith('http')) return clean;

  clean = clean.replace(/\/+/g, '/');

  const hasSlash = clean.startsWith('/');
  const naked = hasSlash ? clean.substring(1) : clean;

  if (naked.startsWith('(tabs)/')) {
    return '/' + naked;
  }

  const tabPaths = [
    'cancionero',
    'calendario',
    'fotos',
    'mas',
    'index',
    'contigo',
  ];

  const isTab = tabPaths.some((p) => naked === p || naked.startsWith(p + '/'));
  if (isTab) {
    return '/(tabs)/' + naked;
  }

  return '/' + naked;
}

function getRouteLabel(route: string) {
  const norm = normalizeRoute(route);
  return ROUTE_LABELS[norm] ?? ROUTE_LABELS[route] ?? null;
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

interface Props {
  visible: boolean;
  onClose: () => void;
  /**
   * Si se pasa, al abrir el sheet se muestra directamente el detalle de esta
   * notificación (vista "en grande") en lugar de la lista. Lo usa la tarjeta de
   * Novedades de la Home para abrir la última notificación concreta.
   */
  initialNotification?: (NotificationData | ReceivedNotification) | null;
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
  const [selectedNotification, setSelectedNotification] = useState<
    (NotificationData | ReceivedNotification) | null
  >(null);

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
    (n: NotificationData | ReceivedNotification) => {
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
    async (notification: NotificationData | ReceivedNotification) => {
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

  // ── Swipe action ──────────────────────────────────────────────────────────
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
        style={listStyles.rightAction}
        onPress={() => handleMarkAsRead(notificationId)}
      >
        <Animated.View
          style={[listStyles.actionContent, { transform: [{ scale }] }]}
        >
          <MaterialIcons name="check" size={24} color="#fff" />
          <Text style={listStyles.actionText}>Leída</Text>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  // ── Render notificación ───────────────────────────────────────────────────
  const renderNotification = ({
    item: notification,
  }: {
    item: NotificationData | ReceivedNotification;
  }) => {
    const isRead = isNotificationRead(notification);
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
      <View style={{ marginBottom: spacing.md }}>
        <Swipeable
          renderRightActions={(progress, dragX) =>
            isUnread
              ? renderRightActions(progress, dragX, notification.id)
              : null
          }
          rightThreshold={40}
          overshootRight={false}
        >
          <TouchableOpacity
            style={[
              listStyles.card,
              {
                backgroundColor: theme.background,
                borderColor: isDark ? '#3A3A3C' : colors.border,
              },
              isUnread && {
                backgroundColor: scheme === 'dark' ? '#1a1a2e' : '#f0f4ff',
                borderColor: colors.primary,
              },
            ]}
            onPress={() => handleNotificationPress(notification)}
            activeOpacity={0.7}
          >
            {notification.icon && (
              <Image
                source={{ uri: notification.icon }}
                style={listStyles.icon}
              />
            )}

            <View style={listStyles.content}>
              <View style={listStyles.row}>
                <Text
                  style={[
                    listStyles.title,
                    { color: theme.text },
                    !isUnread && { fontWeight: '500' },
                  ]}
                  numberOfLines={1}
                >
                  {notification.title}
                </Text>
                <View style={listStyles.rightRow}>
                  {isUnread && <View style={listStyles.dot} />}
                  {isUnread && (
                    <Pressable
                      onPress={() => handleMarkAsRead(notification.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MaterialIcons
                        name="check-circle-outline"
                        size={20}
                        color={colors.primary}
                      />
                    </Pressable>
                  )}
                </View>
              </View>

              <Text
                style={[listStyles.body, { color: theme.icon }]}
                numberOfLines={2}
              >
                {notification.body}
              </Text>

              <View style={listStyles.footer}>
                <Text style={[listStyles.date, { color: theme.icon }]}>
                  {formatDate(date)}
                </Text>
                <View style={listStyles.chipsRow}>
                  {routeInfo && notification.internalRoute && (
                    <Pressable
                      style={listStyles.destChip}
                      onPress={() =>
                        handleDestinationChipPress(notification.internalRoute!)
                      }
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={listStyles.destChipText}>
                        {routeInfo.label}
                      </Text>
                      <MaterialIcons
                        name="chevron-right"
                        size={13}
                        color={colors.primary}
                      />
                    </Pressable>
                  )}
                  {notification.actionButton && (
                    <Pressable
                      style={listStyles.actionChip}
                      onPress={() => {
                        const btn = notification.actionButton!;
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
                      }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={listStyles.actionChipText} numberOfLines={1}>
                        {notification.actionButton.text}
                      </Text>
                      <MaterialIcons
                        name={
                          notification.actionButton.isInternal
                            ? 'chevron-right'
                            : 'open-in-new'
                        }
                        size={11}
                        color="#fff"
                      />
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </Swipeable>
      </View>
    );
  };

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
                listStyles.listContent,
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

// ============================================================================
// Vista de detalle
// ============================================================================

function NotificationDetail({
  notification,
  onClose,
  scheme,
  bottomInset,
}: {
  notification: NotificationData | ReceivedNotification;
  onClose: () => void;
  scheme: 'light' | 'dark';
  bottomInset: number;
}) {
  const theme = Colors[scheme];
  const date = new Date(
    'receivedAt' in notification
      ? notification.receivedAt
      : notification.createdAt,
  );
  const routeInfo = notification.internalRoute
    ? getRouteLabel(notification.internalRoute)
    : null;

  const navigateTo = (route: string) => {
    onClose();
    const clean = normalizeRoute(route);
    setTimeout(() => {
      try {
        router.push(clean as any);
      } catch {}
    }, 320);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          detailStyles.content,
          { paddingBottom: bottomInset + spacing.xl },
        ]}
        showsVerticalScrollIndicator
        scrollIndicatorInsets={{ right: 1 }}
      >
        {notification.icon && (
          <Image
            source={{ uri: notification.icon }}
            style={detailStyles.icon}
          />
        )}

        <Text style={[detailStyles.title, { color: theme.text }]}>
          {notification.title}
        </Text>

        <Text style={[detailStyles.date, { color: theme.icon }]}>
          {date.toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>

        {notification.imageUrl && (
          <Image
            source={{ uri: notification.imageUrl }}
            style={detailStyles.image}
            resizeMode="cover"
          />
        )}

        <Text style={[detailStyles.body, { color: theme.text }]}>
          {notification.body}
        </Text>

        {(notification.internalRoute || notification.actionButton) && (
          <View
            style={[
              detailStyles.divider,
              { backgroundColor: hexAlpha(theme.icon, '20') },
            ]}
          />
        )}

        {notification.internalRoute && (
          <Pressable
            style={[detailStyles.routeBtn, { borderColor: colors.primary }]}
            onPress={() => navigateTo(notification.internalRoute!)}
          >
            <MaterialIcons
              name={(routeInfo?.icon ?? 'launch') as any}
              size={20}
              color={colors.primary}
            />
            <Text
              style={[detailStyles.routeBtnText, { color: colors.primary }]}
            >
              {routeInfo ? `Ir a ${routeInfo.label}` : 'Abrir sección'}
            </Text>
            <MaterialIcons
              name="chevron-right"
              size={20}
              color={colors.primary}
            />
          </Pressable>
        )}

        {notification.actionButton && (
          <Pressable
            style={detailStyles.actionBtn}
            onPress={() => {
              const btn = notification.actionButton!;
              if (btn.isInternal) {
                navigateTo(btn.url);
              } else {
                Linking.openURL(btn.url).catch(logger.error);
              }
            }}
          >
            <Text style={detailStyles.actionBtnText}>
              {notification.actionButton.text}
            </Text>
            <MaterialIcons
              name={
                notification.actionButton.isInternal
                  ? 'chevron-right'
                  : 'open-in-new'
              }
              size={18}
              color="#fff"
            />
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================================
// Estilos
// ============================================================================

const sheetStyles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
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

const listStyles = StyleSheet.create({
  listContent: {
    padding: spacing.md,
  },
  card: {
    flexDirection: 'row',
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    ...shadows.sm,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: spacing.md,
    backgroundColor: colors.border,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  content: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: spacing.xs,
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  date: { fontSize: 11 },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  destChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: hexAlpha(colors.primary, '60'),
    backgroundColor: hexAlpha(colors.primary, '12'),
  },
  destChipText: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '700',
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
  rightAction: {
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.md,
    height: '100%',
    width: 80,
  },
  actionContent: { alignItems: 'center', justifyContent: 'center' },
  actionText: {
    color: '#fff',
    fontWeight: '600',
    marginTop: 4,
    fontSize: 12,
  },
});

const detailStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    alignItems: 'flex-start',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: spacing.md,
    alignSelf: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: spacing.sm,
    lineHeight: 30,
  },
  date: {
    fontSize: 13,
    marginBottom: spacing.lg,
    textTransform: 'capitalize',
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
  },
  body: {
    fontSize: 16,
    lineHeight: 26,
    marginBottom: spacing.lg,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: spacing.lg,
  },
  routeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: radii.md,
    borderWidth: 1.5,
    marginBottom: spacing.md,
  },
  routeBtnText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: radii.lg,
    gap: 10,
    ...shadows.lg,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});

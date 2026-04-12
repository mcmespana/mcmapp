import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  Modal,
  PanResponder,
  Dimensions,
  Platform,
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
} from '@/services/pushNotificationService';
import { NotificationData, ReceivedNotification } from '@/types/notifications';
import { useNotifications } from '@/contexts/NotificationsContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DRAG_THRESHOLD = 60;
const SHEET_GAP = 80; // espacio por debajo del safe-area (notch/Dynamic Island)

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
};

function getRouteLabel(route: string) {
  return ROUTE_LABELS[route] ?? null;
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
}

export default function NotificationsBottomSheet({ visible, onClose }: Props) {
  const scheme = useColorScheme() ?? 'light';
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

  // ── Animación ──────────────────────────────────────────────────────────────
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // Ref estable para onClose — evita stale closure en PanResponder
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // PanResponder usa refs directamente, sin capturar callbacks que puedan quedar obsoletos
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dy, dx }) =>
        Math.abs(dy) > Math.abs(dx) && dy > 2,
      onPanResponderMove: (_, { dy }) => {
        if (dy > 0) translateY.setValue(dy);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > DRAG_THRESHOLD || vy > 0.5) {
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: SCREEN_HEIGHT,
              duration: 280,
              useNativeDriver: true,
            }),
            Animated.timing(overlayOpacity, {
              toValue: 0,
              duration: 220,
              useNativeDriver: true,
            }),
          ]).start(() => {
            onCloseRef.current?.();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        // Si otro gestor roba el gesto, volvemos a posición original
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }).start();
      },
    }),
  ).current;

  const animateOpen = useCallback(() => {
    translateY.setValue(SCREEN_HEIGHT);
    overlayOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 12,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, overlayOpacity]);

  const animateClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSelectedNotification(null);
      onClose();
    });
  }, [translateY, overlayOpacity, onClose]);

  useEffect(() => {
    if (visible) {
      animateOpen();
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
      console.error('Error cargando notificaciones:', e);
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

  const allNotifications = [...localNotifications, ...firebaseNotifications]
    .sort((a, b) => {
      const dA = new Date('receivedAt' in a ? a.receivedAt : a.createdAt);
      const dB = new Date('receivedAt' in b ? b.receivedAt : b.createdAt);
      return dB.getTime() - dA.getTime();
    })
    .filter((n, i, self) => {
      if (!n.id) return true;
      return i === self.findIndex((x) => x.id === n.id);
    });

  const hasUnread = allNotifications.some(
    (n) => !readIds.has(n.id) && !('isRead' in n && n.isRead),
  );

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
      .filter((n) => !readIds.has(n.id) && !('isRead' in n && n.isRead))
      .map((n) => n.id);
    if (!unreadIds.length) return;
    await markAllNotificationsAsRead(unreadIds);
    await loadLocalData();
    refreshCount();
  };

  const handleNotificationPress = useCallback(
    async (notification: NotificationData | ReceivedNotification) => {
      const isRead =
        readIds.has(notification.id) ||
        ('isRead' in notification && notification.isRead);
      if (!isRead) await handleMarkAsRead(notification.id);
      setSelectedNotification(notification);
    },
    [readIds, handleMarkAsRead],
  );

  // Chip de destino → navega directamente sin abrir el detalle
  const handleDestinationChipPress = useCallback(
    (route: string) => {
      animateClose();
      // Esperar a que el sheet cierre antes de navegar
      setTimeout(() => {
        try {
          router.push(route as any);
        } catch (e) {
          console.error('Error navegando:', e);
        }
      }, 320);
    },
    [animateClose],
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
        <TouchableOpacity
          style={[
            listStyles.card,
            { backgroundColor: theme.background, borderColor: colors.border },
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
            {/* Título + indicadores */}
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

            {/* Cuerpo */}
            <Text
              style={[listStyles.body, { color: theme.icon }]}
              numberOfLines={2}
            >
              {notification.body}
            </Text>

            {/* Footer: fecha + chips */}
            <View style={listStyles.footer}>
              <Text style={[listStyles.date, { color: theme.icon }]}>
                {formatDate(date)}
              </Text>
              <View style={listStyles.chipsRow}>
                {/* Chip de destino → navega directo con "›" */}
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
                {/* Chip de acción */}
                {notification.actionButton && (
                  <Pressable
                    style={listStyles.actionChip}
                    onPress={() => {
                      const btn = notification.actionButton!;
                      animateClose();
                      setTimeout(() => {
                        if (btn.isInternal) {
                          try {
                            router.push(btn.url as any);
                          } catch (e) {}
                        } else {
                          Linking.openURL(btn.url).catch(console.error);
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
    );
  };

  if (!visible) return null;

  // Offset dinámico: siempre por debajo del safe area (notch / Dynamic Island)
  const topOffset = insets.top + SHEET_GAP;
  const sheetHeight = SCREEN_HEIGHT - topOffset;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={animateClose}
      statusBarTranslucent
    >
      {/* Overlay oscuro — Pressable para cerrar al tocar fuera del sheet */}
      <Pressable style={StyleSheet.absoluteFill} onPress={animateClose}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            sheetStyles.overlay,
            { opacity: overlayOpacity },
          ]}
          pointerEvents="none"
        />
      </Pressable>

      {/* Sheet */}
      <Animated.View
        style={[
          sheetStyles.sheet,
          {
            height: sheetHeight,
            top: topOffset,
            backgroundColor: theme.background,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* Handle — zona de arrastre, ancho completo */}
        <View {...panResponder.panHandlers} style={sheetStyles.handleArea}>
          <View
            style={[
              sheetStyles.handle,
              { backgroundColor: hexAlpha(theme.icon, '35') },
            ]}
          />
        </View>

        {selectedNotification ? (
          <NotificationDetail
            notification={selectedNotification}
            onBack={() => setSelectedNotification(null)}
            onClose={animateClose}
            scheme={scheme}
            bottomInset={insets.bottom}
          />
        ) : (
          <>
            {/* Cabecera lista */}
            <View
              style={[
                sheetStyles.header,
                { borderBottomColor: hexAlpha(theme.icon, '15') },
              ]}
            >
              {hasUnread ? (
                <TouchableOpacity
                  onPress={handleMarkAllAsRead}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons
                    name="done-all"
                    size={22}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              ) : (
                <View style={{ width: 32 }} />
              )}
              <Text style={[sheetStyles.headerTitle, { color: theme.text }]}>
                Notificaciones
              </Text>
              <TouchableOpacity
                onPress={animateClose}
                style={sheetStyles.closeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <MaterialIcons name="close" size={22} color={theme.icon} />
              </TouchableOpacity>
            </View>

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
      </Animated.View>
    </Modal>
  );
}

// ============================================================================
// Vista de detalle — reemplaza la lista dentro del sheet (sin bottom sheet anidado)
// ============================================================================

function NotificationDetail({
  notification,
  onBack,
  onClose,
  scheme,
  bottomInset,
}: {
  notification: NotificationData | ReceivedNotification;
  onBack: () => void;
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
    setTimeout(() => {
      try {
        router.push(route as any);
      } catch (e) {}
    }, 320);
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Cabecera del detalle */}
      <View
        style={[
          detailStyles.header,
          { borderBottomColor: hexAlpha(theme.icon, '15') },
        ]}
      >
        <TouchableOpacity
          onPress={onBack}
          style={detailStyles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text
          style={[detailStyles.headerTitle, { color: theme.text }]}
          numberOfLines={1}
        >
          {notification.title}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Contenido scrollable */}
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

        {(routeInfo || notification.actionButton) && (
          <View
            style={[
              detailStyles.divider,
              { backgroundColor: hexAlpha(theme.icon, '20') },
            ]}
          />
        )}

        {/* Botón de destino interno */}
        {routeInfo && notification.internalRoute && (
          <Pressable
            style={[detailStyles.routeBtn, { borderColor: colors.primary }]}
            onPress={() => navigateTo(notification.internalRoute!)}
          >
            <MaterialIcons
              name={routeInfo.icon}
              size={20}
              color={colors.primary}
            />
            <Text
              style={[detailStyles.routeBtnText, { color: colors.primary }]}
            >
              Ir a {routeInfo.label}
            </Text>
            <MaterialIcons
              name="chevron-right"
              size={20}
              color={colors.primary}
            />
          </Pressable>
        )}

        {/* Botón de acción CTA */}
        {notification.actionButton && (
          <Pressable
            style={detailStyles.actionBtn}
            onPress={() => {
              const btn = notification.actionButton!;
              if (btn.isInternal) {
                navigateTo(btn.url);
              } else {
                Linking.openURL(btn.url).catch(console.error);
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
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
      },
      android: { elevation: 20 },
    }),
  },
  handleArea: {
    alignItems: 'center',
    justifyContent: 'center',
    // Ancho completo + generosa área vertical para que sea fácil de agarrar
    width: '100%',
    paddingTop: 14,
    paddingBottom: 10,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: spacing.md,
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

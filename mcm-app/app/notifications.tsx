import { logger } from '@/utils/logger';
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  FlatList,
  Linking,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { BottomSheet, Button } from 'heroui-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from 'expo-router/react-navigation';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import colors, { Colors, themeColors } from '@/constants/colors';
import EmptyState from '@/components/ui/EmptyState';
import AppChip from '@/components/ui/AppChip';
import { hexAlpha } from '@/utils/colorUtils';
import { capitalizeFirst } from '@/utils/textCase';
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
  dismissNotification,
  getDismissedNotificationKeys,
} from '@/services/pushNotificationService';
import {
  NotificationData,
  NotificationActionButtonData,
  ReceivedNotification,
} from '@/types/notifications';
import { categoryVisual } from '@/utils/notificationCategory';
import { routeForEventId } from '@/utils/notificationEventRoute';
import { getEvent } from '@/constants/events';
import { useNotifications } from '@/contexts/NotificationsContext';
import NotificationPermissionBanner from '@/components/NotificationPermissionBanner';
import ContextMenuSheet, {
  ContextMenuAction,
} from '@/components/ContextMenuSheet';
import { createStyles } from '@/components/notifications/notificationsStyles';
import NotificationListItem from '@/components/notifications/NotificationListItem';
import {
  getActionButtons,
  getRouteLabel,
  normalizeRoute,
} from '@/components/notifications/notificationDisplay';
import typography from '@/constants/typography';

// «Volver» (24 pt) y «marcar todas» (30 pt) por debajo de 44 pt: el margen
// táctil extra los lleva por encima sin cambiar el aspecto.
const BACK_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const scheme = useColorScheme();
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const listTheme = Colors[scheme ?? 'light'];
  const { firebaseNotifications, refreshCount } = useNotifications();
  // Deep-link: al tocar una notificación push (desde la bandeja del sistema) la
  // app abre esta pantalla con `openId` para mostrar esa notificación en grande.
  const { openId } = useLocalSearchParams<{ openId?: string }>();
  const autoOpenedIdRef = React.useRef<string | null>(null);

  const [localNotifications, setLocalNotifications] = useState<
    ReceivedNotification[]
  >([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<
    (NotificationData | ReceivedNotification) | null
  >(null);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
  // Notificación sobre la que se abre el menú contextual (long-press / clic der.)
  const [menuNotification, setMenuNotification] = useState<
    (NotificationData | ReceivedNotification) | null
  >(null);

  // Helper reutilizable para saber si una notificación está leída.
  // Declarado arriba porque otros callbacks lo consumen como dependencia.
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

  const loadLocalData = useCallback(async () => {
    try {
      const localNotifs = await getLocalNotificationsHistory();
      setLocalNotifications(localNotifs);
      const readNotificationIds = await getReadNotificationIds();
      setReadIds(new Set(readNotificationIds));
      const dismissed = await getDismissedNotificationKeys();
      setDismissedKeys(dismissed);
    } catch (error) {
      logger.error('Error cargando notificaciones:', error);
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
      .filter((n) => !isNotificationRead(n))
      .map((n) => n.id);
    if (unreadIds.length === 0) return;
    await markAllNotificationsAsRead(unreadIds);
    await loadLocalData();
    refreshCount();
  };

  const handleNotificationPress = useCallback(
    async (notification: NotificationData | ReceivedNotification) => {
      if (!isNotificationRead(notification)) {
        await handleMarkAsRead(notification.id);
      }
      setSelectedNotification(notification);
    },
    [isNotificationRead, handleMarkAsRead],
  );

  const handleDelete = useCallback(
    async (notification: NotificationData | ReceivedNotification) => {
      // Optimista: ocultar de inmediato añadiendo sus claves al set local.
      setDismissedKeys((prev) => {
        const next = new Set(prev);
        if (notification.id) next.add(notification.id);
        next.add(`${notification.title}|${notification.body}`);
        return next;
      });
      await dismissNotification(notification);
      await loadLocalData();
      refreshCount();
    },
    [loadLocalData, refreshCount],
  );

  // Abre el menú contextual (marcar leída / eliminar) sobre una notificación.
  const openContextMenu = useCallback(
    (notification: NotificationData | ReceivedNotification) => {
      setMenuNotification(notification);
    },
    [],
  );

  const safePushRoute = useCallback((route: string) => {
    if (!route) return;
    const clean = normalizeRoute(route);
    try {
      router.push(clean as any);
    } catch (e) {
      logger.warn(
        'Navigation failed for ' + clean + ', trying direct route...',
        e,
      );
      try {
        router.push(route as any);
      } catch (err) {
        logger.error('All navigation fallbacks failed:', err);
      }
    }
  }, []);

  const handleActionButtonPress = useCallback(
    (
      notification: NotificationData | ReceivedNotification,
      button: NotificationActionButtonData,
    ) => {
      if (!isNotificationRead(notification)) {
        handleMarkAsRead(notification.id).catch((err) =>
          logger.error('Error marcando como leída:', err),
        );
      }
      if (!button) return;
      if (button.isInternal) {
        safePushRoute(button.url);
      } else {
        Linking.openURL(button.url).catch((err) =>
          logger.error('Error abriendo URL:', err),
        );
      }
    },
    [isNotificationRead, handleMarkAsRead, safePushRoute],
  );

  const renderNotification = ({
    item: notification,
  }: {
    item: NotificationData | ReceivedNotification;
  }) => (
    <NotificationListItem
      notification={notification}
      isRead={isNotificationRead(notification)}
      theme={listTheme}
      isDark={scheme === 'dark'}
      scheme={scheme ?? 'light'}
      onPress={handleNotificationPress}
      onMarkRead={handleMarkAsRead}
      onDestinationPress={safePushRoute}
      onActionPress={(button) => handleActionButtonPress(notification, button)}
      onLongPress={openContextMenu}
    />
  );

  // Combinar Firebase (real-time) + locales, deduplicar, ordenar.
  // Locales van primero porque tienen estado `isRead` más fiable.
  const allNotifications = React.useMemo(() => {
    const combined = [...localNotifications, ...firebaseNotifications]
      // Ocultar las descartadas (por id o por clave de contenido).
      .filter(
        (n) =>
          !dismissedKeys.has(n.id) &&
          !dismissedKeys.has(`${n.title}|${n.body}`),
      )
      .sort((a, b) => {
        const dateA = new Date('receivedAt' in a ? a.receivedAt : a.createdAt);
        const dateB = new Date('receivedAt' in b ? b.receivedAt : b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });

    // Deduplicar por contenido (título + cuerpo) o por ID — la primera
    // aparición gana. Al encontrar un duplicado, completamos en la copia
    // conservada los campos que solo trae el otro origen: la `bodyLong` puede
    // venir solo en el registro de Firebase (si el panel no la mete en el
    // payload de la push) o solo en la copia local. Así el detalle siempre la
    // muestra independientemente de por dónde haya llegado.
    const result: (NotificationData | ReceivedNotification)[] = [];
    const indexByKey = new Map<string, number>();
    const indexById = new Map<string, number>();

    for (const notification of combined) {
      const contentKey = `${notification.title}|${notification.body}`;
      const existingIdx =
        (notification.id ? indexById.get(notification.id) : undefined) ??
        indexByKey.get(contentKey);

      if (existingIdx !== undefined) {
        const kept = result[existingIdx];
        if (!kept.bodyLong && notification.bodyLong) {
          result[existingIdx] = { ...kept, bodyLong: notification.bodyLong };
        }
        continue;
      }

      result.push(notification);
      const idx = result.length - 1;
      indexByKey.set(contentKey, idx);
      if (notification.id) indexById.set(notification.id, idx);
    }
    return result;
  }, [localNotifications, firebaseNotifications, dismissedKeys]);

  const hasUnread = allNotifications.some((n) => !isNotificationRead(n));

  // Auto-abrir el detalle de la notificación indicada por `openId` (deep-link
  // desde una push). Esperamos a que la lista esté cargada para que la
  // notificación recién recibida ya esté disponible y haga match por id.
  useEffect(() => {
    if (!openId || loading) return;
    if (autoOpenedIdRef.current === openId) return;
    const match = allNotifications.find((n) => n.id === openId);
    if (match) {
      autoOpenedIdRef.current = openId;
      handleNotificationPress(match);
    }
  }, [openId, loading, allNotifications, handleNotificationPress]);

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
          hitSlop={BACK_HIT_SLOP}
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
            hitSlop={BACK_HIT_SLOP}
            accessibilityLabel="Marcar todas como leídas"
            accessibilityRole="button"
          >
            <MaterialIcons
              name="done-all"
              size={22}
              color={themeColors(scheme === 'dark').link}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerRight} />
        )}
      </View>

      <NotificationPermissionBanner placement="notifications" />

      {loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Cargando...</Text>
        </View>
      ) : allNotifications.length === 0 ? (
        <EmptyState
          icon="notifications-none"
          title="No hay notificaciones"
          subtitle="Aquí aparecerán tus notificaciones cuando las tengas."
        />
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

      {/* Menú contextual (long-press / clic derecho) sobre una notificación */}
      <ContextMenuSheet
        visible={menuNotification !== null}
        onClose={() => setMenuNotification(null)}
        title={menuNotification?.title}
        actions={
          menuNotification
            ? ([
                ...(!isNotificationRead(menuNotification)
                  ? [
                      {
                        key: 'read',
                        label: 'Marcar como leída',
                        icon: 'check-circle-outline',
                        onPress: () => handleMarkAsRead(menuNotification.id),
                      },
                    ]
                  : []),
                {
                  key: 'delete',
                  label: 'Eliminar',
                  icon: 'delete-outline',
                  destructive: true,
                  onPress: () => handleDelete(menuNotification),
                },
              ] as ContextMenuAction[])
            : []
        }
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
  const date = notification
    ? new Date(
        'receivedAt' in notification
          ? notification.receivedAt
          : notification.createdAt,
      )
    : new Date();
  const routeInfo = notification?.internalRoute
    ? getRouteLabel(notification.internalRoute)
    : null;
  const category = categoryVisual(notification?.category);
  // Deep link a un evento concreto (data.eventId): si resuelve a una ruta del
  // registry, ofrecemos un botón "Ir a <evento>".
  const eventRoute = notification?.eventId
    ? routeForEventId(notification.eventId)
    : null;
  const eventTitle =
    eventRoute && notification?.eventId
      ? getEvent(notification.eventId).title
      : null;

  const safePushRoute = (route: string) => {
    if (!route) return;
    const clean = normalizeRoute(route);
    try {
      router.push(clean as any);
    } catch (e) {
      logger.warn(
        'Navigation failed for ' + clean + ', trying direct route...',
        e,
      );
      try {
        router.push(route as any);
      } catch (err) {
        logger.error('All navigation fallbacks failed:', err);
      }
    }
  };

  const actionButtons = notification ? getActionButtons(notification) : [];

  const handleInternalRoute = () => {
    if (!notification) return;
    onClose();
    safePushRoute(notification.internalRoute ?? '');
  };

  const handleEventRoute = () => {
    if (!eventRoute) return;
    onClose();
    safePushRoute(eventRoute);
  };

  const handleActionButton = (button: NotificationActionButtonData) => {
    if (!button) return;
    if (button.isInternal) {
      onClose();
      safePushRoute(button.url);
    } else {
      Linking.openURL(button.url).catch((err) =>
        logger.error('Error abriendo URL:', err),
      );
    }
  };

  return (
    <BottomSheet
      isOpen={!!notification}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
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
                  <Image
                    source={{ uri: notification.icon }}
                    style={dStyles.icon}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                )}

                {/* Título */}
                <BottomSheet.Title
                  style={[dStyles.title, { color: theme.text }]}
                >
                  {notification.title}
                </BottomSheet.Title>

                {/* Fecha */}
                <Text style={[dStyles.date, { color: theme.icon }]}>
                  {capitalizeFirst(
                    date.toLocaleDateString('es-ES', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                  )}
                </Text>

                {/* Chip de categoría de negocio (data.category) */}
                {category && (
                  <AppChip
                    label={category.label}
                    color={category.color}
                    icon={category.icon as never}
                    size="md"
                    style={dStyles.detailChip}
                  />
                )}

                {/* Imagen grande */}
                {notification.imageUrl && (
                  <Image
                    source={{ uri: notification.imageUrl }}
                    style={dStyles.image}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={200}
                  />
                )}

                {/* Cuerpo: descripción extendida (bodyLong) si existe, si no el
                    body corto como fallback. El ScrollView del modal permite
                    textos largos. */}
                <Text style={[dStyles.body, { color: theme.text }]}>
                  {notification.bodyLong || notification.body}
                </Text>

                {/* Separador si hay acciones */}
                {(notification.internalRoute ||
                  eventRoute ||
                  actionButtons.length > 0) && (
                  <View
                    style={[
                      dStyles.divider,
                      { backgroundColor: hexAlpha(theme.icon, '30') },
                    ]}
                  />
                )}

                {/* Botón de deep link a un evento (data.eventId) */}
                {eventRoute && (
                  <Button
                    variant="outline"
                    onPress={handleEventRoute}
                    style={[
                      dStyles.routeButton,
                      { borderColor: themeColors(scheme === 'dark').link },
                    ]}
                  >
                    <MaterialIcons
                      name="event"
                      size={20}
                      color={themeColors(scheme === 'dark').link}
                    />
                    <Button.Label
                      style={{
                        color: themeColors(scheme === 'dark').link,
                        flex: 1,
                      }}
                    >
                      {eventTitle ? `Ir a ${eventTitle}` : 'Ir al evento'}
                    </Button.Label>
                    <MaterialIcons
                      name="arrow-forward-ios"
                      size={14}
                      color={themeColors(scheme === 'dark').link}
                    />
                  </Button>
                )}

                {/* Botón de destino interno (internalRoute) */}
                {notification.internalRoute && (
                  <Button
                    variant="outline"
                    onPress={handleInternalRoute}
                    style={[
                      dStyles.routeButton,
                      { borderColor: themeColors(scheme === 'dark').link },
                    ]}
                  >
                    <MaterialIcons
                      name={(routeInfo?.icon ?? 'launch') as any}
                      size={20}
                      color={themeColors(scheme === 'dark').link}
                    />
                    <Button.Label
                      style={{
                        color: themeColors(scheme === 'dark').link,
                        flex: 1,
                      }}
                    >
                      {routeInfo ? `Ir a ${routeInfo.label}` : 'Abrir sección'}
                    </Button.Label>
                    <MaterialIcons
                      name="arrow-forward-ios"
                      size={14}
                      color={themeColors(scheme === 'dark').link}
                    />
                  </Button>
                )}

                {/* Botones de acción CTA (hasta 3). El primero destaca como
                    primario; los siguientes van en estilo secundario. */}
                {actionButtons.map((button, idx) => (
                  <Button
                    key={`${button.url}-${idx}`}
                    variant={idx === 0 ? 'primary' : 'secondary'}
                    onPress={() => handleActionButton(button)}
                    style={[
                      dStyles.actionButton,
                      idx > 0 && dStyles.actionButtonSecondary,
                      idx > 0 && {
                        backgroundColor: hexAlpha(
                          themeColors(scheme === 'dark').link,
                          '12',
                        ),
                        borderColor: themeColors(scheme === 'dark').link,
                      },
                    ]}
                  >
                    <Button.Label
                      style={
                        idx === 0
                          ? dStyles.actionButtonText
                          : [
                              dStyles.actionButtonTextSecondary,
                              { color: themeColors(scheme === 'dark').link },
                            ]
                      }
                    >
                      {button.text}
                    </Button.Label>
                    <MaterialIcons
                      name={button.isInternal ? 'arrow-forward' : 'open-in-new'}
                      size={18}
                      color={
                        idx === 0 ? '#fff' : themeColors(scheme === 'dark').link
                      }
                    />
                  </Button>
                ))}
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
    borderRadius: radii.pillFull,
    marginBottom: spacing.md,
    alignSelf: 'center',
  },
  title: { fontSize: 22, fontWeight: '700', marginBottom: spacing.sm },
  // Sin `textTransform: 'capitalize'`: la cadena tiene varias palabras y
  // capitalize las pone TODAS en mayúscula («10 De Septiembre De 2026 A Las
  // 14:32»). La inicial la pone `capitalizeFirst`.
  date: { fontSize: 13, marginBottom: spacing.lg },
  // El chip lo pinta `AppChip`; esto es solo su sitio en la columna.
  detailChip: { marginTop: -spacing.sm, marginBottom: spacing.lg },
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
    ...typography.button,
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
    marginBottom: spacing.md,
    ...shadows.overlay,
    shadowColor: colors.primary,
  },
  actionButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  // Ojo: los valores de aquí son los de MODO CLARO. El azul de marca sobre
  // fondo oscuro da 1,3:1 (invisible), así que quien use estos estilos los
  // sobrescribe con `themeColors(isDark).link`. Ver `design.md` §3.
  actionButtonSecondary: {
    backgroundColor: hexAlpha(colors.primary, '12'),
    borderWidth: 1.5,
    borderColor: colors.primary,
    ...shadows.card,
    shadowColor: colors.primary,
  },
  actionButtonTextSecondary: {
    color: colors.primary,
    ...typography.body,
    fontWeight: '700',
  },
});

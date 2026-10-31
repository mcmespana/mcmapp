import { View, StyleSheet, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { TouchableOpacity } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SharedValue } from 'react-native-reanimated';
import SwipeActionContent from '@/components/ui/SwipeActionContent';
import { MaterialIcons } from '@expo/vector-icons';
import colors, { themeColors, Colors } from '@/constants/colors';
import { hexAlpha } from '@/utils/colorUtils';
import spacing from '@/constants/spacing';
import { radii, shadows } from '@/constants/uiStyles';
import { NotificationData, ReceivedNotification } from '@/types/notifications';
import {
  getRouteLabel,
  getActionButtons,
  formatDate,
} from './notificationDisplay';
import typography from '@/constants/typography';
import AppChip from '@/components/ui/AppChip';
import { categoryVisual } from '@/utils/notificationCategory';
import { useContextMenu } from '@/hooks/useContextMenu';

type Notification = NotificationData | ReceivedNotification;
type ActionButton = NonNullable<Notification['actionButton']>;

/**
 * Tarjeta de una notificación en la lista, con swipe-para-marcar-leída, dot de
 * no leída, chip de categoría, chip de destino y chips de los botones de
 * acción (hasta 3). Es la ÚNICA tarjeta: la usan la hoja de la campana de
 * Inicio y la pantalla `/notifications`, para que la misma notificación se vea
 * igual entre por donde entres. La lógica de marcado/navegación vive en el
 * padre y se recibe por props para no duplicar estado.
 */
export default function NotificationListItem({
  notification,
  isRead,
  theme,
  isDark,
  scheme,
  onPress,
  onMarkRead,
  onDestinationPress,
  onActionPress,
  onLongPress,
}: {
  notification: Notification;
  isRead: boolean;
  theme: typeof Colors.light;
  isDark: boolean;
  scheme: 'light' | 'dark';
  onPress: (notification: Notification) => void;
  onMarkRead: (id: string) => void;
  onDestinationPress: (route: string) => void;
  onActionPress: (button: ActionButton) => void;
  /** Long-press en nativo / clic derecho en web (menú contextual). */
  onLongPress?: (notification: Notification) => void;
}) {
  const isUnread = !isRead;
  const ctx = useContextMenu(
    onLongPress ? () => onLongPress(notification) : undefined,
  );
  const date = new Date(
    'receivedAt' in notification
      ? notification.receivedAt
      : notification.createdAt,
  );
  const routeInfo = notification.internalRoute
    ? getRouteLabel(notification.internalRoute)
    : null;
  const category = categoryVisual(notification.category);
  const actionButtons = getActionButtons(notification);

  const renderRightActions = (translation: SharedValue<number>) => (
    <TouchableOpacity
      style={listStyles.rightAction}
      onPress={() => onMarkRead(notification.id)}
      accessibilityLabel="Marcar como leída"
      accessibilityRole="button"
    >
      <SwipeActionContent
        translation={translation}
        inputRange={[-100, 0]}
        outputRange={[1, 0]}
        property="scale"
        style={listStyles.actionContent}
      >
        <MaterialIcons name="check" size={24} color="#fff" />
        <Text style={listStyles.actionText}>Leída</Text>
      </SwipeActionContent>
    </TouchableOpacity>
  );

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Swipeable
        renderRightActions={(_progress, translation) =>
          isUnread ? renderRightActions(translation) : null
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
              borderColor: themeColors(isDark).link,
            },
          ]}
          onPress={() => onPress(notification)}
          activeOpacity={0.7}
          accessibilityLabel={`${isUnread ? 'No leída: ' : ''}${notification.title}`}
          accessibilityRole="button"
          {...ctx}
        >
          {notification.icon && (
            <Image
              source={{ uri: notification.icon }}
              style={listStyles.icon}
              contentFit="cover"
              cachePolicy="memory-disk"
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
                    style={listStyles.markReadButton}
                    onPress={(e) => {
                      // Pressable anidado: que el toque no llegue a la tarjeta.
                      e?.stopPropagation?.();
                      onMarkRead(notification.id);
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel="Marcar como leída"
                    accessibilityRole="button"
                  >
                    <MaterialIcons
                      name="check-circle-outline"
                      size={20}
                      color={themeColors(isDark).link}
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
                {/* Categoría de negocio: solo las que tienen significado
                    propio; "general"/desconocida no pinta chip. */}
                {category && (
                  <AppChip
                    label={category.label}
                    color={category.color}
                    icon={category.icon as never}
                  />
                )}
                {routeInfo && notification.internalRoute && (
                  <Pressable
                    style={[
                      listStyles.destChip,
                      {
                        borderColor: hexAlpha(themeColors(isDark).link, '60'),
                        backgroundColor: hexAlpha(
                          themeColors(isDark).link,
                          '12',
                        ),
                      },
                    ]}
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      onDestinationPress(notification.internalRoute!);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel={`Ir a ${routeInfo.label}`}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        listStyles.destChipText,
                        { color: themeColors(isDark).link },
                      ]}
                    >
                      {routeInfo.label}
                    </Text>
                    <MaterialIcons
                      name="chevron-right"
                      size={13}
                      color={themeColors(isDark).link}
                    />
                  </Pressable>
                )}
                {actionButtons.map((button, idx) => (
                  <Pressable
                    key={`${button.url}-${idx}`}
                    style={listStyles.actionChip}
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      onActionPress(button);
                    }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    accessibilityLabel={button.text}
                    accessibilityRole="button"
                  >
                    <Text style={listStyles.actionChipText} numberOfLines={1}>
                      {button.text}
                    </Text>
                    <MaterialIcons
                      name={button.isInternal ? 'chevron-right' : 'open-in-new'}
                      size={11}
                      color="#fff"
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>
    </View>
  );
}

const listStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    ...shadows.card,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radii.xl,
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
  markReadButton: { padding: 2 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.xs,
    backgroundColor: colors.primary,
  },
  body: {
    ...typography.caption,
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
    borderRadius: radii.xl,
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
    borderRadius: radii.xl,
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
    backgroundColor: colors.green,
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
    ...typography.footnote,
  },
});

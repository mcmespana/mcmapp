import {
  View,
  StyleSheet,
  Text,
  Image,
  Animated,
  Pressable,
} from 'react-native';
import { TouchableOpacity, Swipeable } from 'react-native-gesture-handler';
import { MaterialIcons } from '@expo/vector-icons';
import colors, { Colors } from '@/constants/colors';
import { hexAlpha } from '@/utils/colorUtils';
import spacing from '@/constants/spacing';
import { radii, shadows } from '@/constants/uiStyles';
import { NotificationData, ReceivedNotification } from '@/types/notifications';
import { getRouteLabel, formatDate } from './notificationDisplay';

type Notification = NotificationData | ReceivedNotification;
type ActionButton = NonNullable<Notification['actionButton']>;

/**
 * Tarjeta de una notificación en la lista, con swipe-para-marcar-leída, dot de
 * no leída, chip de destino y chip de botón de acción. Extraído de
 * NotificationsBottomSheet. La lógica de marcado/navegación vive en el padre y
 * se recibe por props para no duplicar estado.
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
}) {
  const isUnread = !isRead;
  const date = new Date(
    'receivedAt' in notification
      ? notification.receivedAt
      : notification.createdAt,
  );
  const routeInfo = notification.internalRoute
    ? getRouteLabel(notification.internalRoute)
    : null;

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });
    return (
      <TouchableOpacity
        style={listStyles.rightAction}
        onPress={() => onMarkRead(notification.id)}
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

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Swipeable
        renderRightActions={(progress, dragX) =>
          isUnread ? renderRightActions(progress, dragX) : null
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
          onPress={() => onPress(notification)}
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
                    onPress={() => onMarkRead(notification.id)}
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
                      onDestinationPress(notification.internalRoute!)
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
                    onPress={() => onActionPress(notification.actionButton!)}
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
}

const listStyles = StyleSheet.create({
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

import { logger } from '@/utils/logger';
import {
  View,
  StyleSheet,
  Text,
  Image,
  Linking,
  ScrollView,
  Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import colors, { Colors } from '@/constants/colors';
import { hexAlpha } from '@/utils/colorUtils';
import spacing from '@/constants/spacing';
import { radii, shadows } from '@/constants/uiStyles';
import { NotificationData, ReceivedNotification } from '@/types/notifications';
import { getRouteLabel, normalizeRoute } from './notificationDisplay';

/**
 * Vista "en grande" de una notificación concreta (título, imagen, cuerpo y
 * botones de acción/destino). Extraído de NotificationsBottomSheet.
 */
export default function NotificationDetail({
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

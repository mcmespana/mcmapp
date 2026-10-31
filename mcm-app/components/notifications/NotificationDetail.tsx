import { logger } from '@/utils/logger';
import { capitalizeFirst } from '@/utils/textCase';
import {
  View,
  StyleSheet,
  Text,
  Linking,
  ScrollView,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@/components/ui/icons';
import { useTabNavigation } from '@/hooks/useTabNavigation';
import colors, { themeColors, Colors } from '@/constants/colors';
import { hexAlpha } from '@/utils/colorUtils';
import spacing from '@/constants/spacing';
import { radii, shadows } from '@/constants/uiStyles';
import { NotificationData, ReceivedNotification } from '@/types/notifications';
import {
  getRouteLabel,
  getActionButtons,
  normalizeRoute,
} from './notificationDisplay';
import AppChip from '@/components/ui/AppChip';
import { categoryVisual } from '@/utils/notificationCategory';
import typography from '@/constants/typography';

/**
 * Vista "en grande" de una notificación concreta (título, categoría, imagen,
 * cuerpo y botones de acción/destino). Extraído de NotificationsBottomSheet.
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
  const { goToPath } = useTabNavigation();
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

  const navigateTo = (route: string) => {
    onClose();
    const clean = normalizeRoute(route);
    setTimeout(() => {
      try {
        goToPath(clean);
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
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        )}

        <Text style={[detailStyles.title, { color: theme.text }]}>
          {notification.title}
        </Text>

        <Text style={[detailStyles.date, { color: theme.icon }]}>
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

        {category && (
          <AppChip
            label={category.label}
            color={category.color}
            icon={category.icon as never}
            size="md"
            style={detailStyles.categoryChip}
          />
        )}

        {notification.imageUrl && (
          <Image
            source={{ uri: notification.imageUrl }}
            style={detailStyles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
          />
        )}

        <Text style={[detailStyles.body, { color: theme.text }]}>
          {notification.body}
        </Text>

        {(notification.internalRoute || actionButtons.length > 0) && (
          <View
            style={[
              detailStyles.divider,
              { backgroundColor: hexAlpha(theme.icon, '20') },
            ]}
          />
        )}

        {notification.internalRoute && (
          <Pressable
            style={[
              detailStyles.routeBtn,
              { borderColor: themeColors(scheme === 'dark').link },
            ]}
            onPress={() => navigateTo(notification.internalRoute!)}
          >
            <MaterialIcons
              name={(routeInfo?.icon ?? 'launch') as any}
              size={20}
              color={themeColors(scheme === 'dark').link}
            />
            <Text
              style={[
                detailStyles.routeBtnText,
                { color: themeColors(scheme === 'dark').link },
              ]}
            >
              {routeInfo ? `Ir a ${routeInfo.label}` : 'Abrir sección'}
            </Text>
            <MaterialIcons
              name="chevron-right"
              size={20}
              color={themeColors(scheme === 'dark').link}
            />
          </Pressable>
        )}

        {/* Botones de acción (hasta 3): el primero destaca como primario y los
            siguientes van en estilo secundario, como en la pantalla completa. */}
        {actionButtons.map((button, idx) => {
          const link = themeColors(scheme === 'dark').link;
          return (
            <Pressable
              key={`${button.url}-${idx}`}
              style={[
                detailStyles.actionBtn,
                idx > 0 && [
                  detailStyles.actionBtnSecondary,
                  { backgroundColor: hexAlpha(link, '12'), borderColor: link },
                ],
              ]}
              onPress={() => {
                if (button.isInternal) {
                  navigateTo(button.url);
                } else {
                  Linking.openURL(button.url).catch(logger.error);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={button.text}
            >
              <Text
                style={[detailStyles.actionBtnText, idx > 0 && { color: link }]}
              >
                {button.text}
              </Text>
              <MaterialIcons
                name={button.isInternal ? 'chevron-right' : 'open-in-new'}
                size={18}
                color={idx === 0 ? '#fff' : link}
              />
            </Pressable>
          );
        })}
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
    ...typography.body,
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
    borderRadius: radii.pillFull,
    marginBottom: spacing.md,
    alignSelf: 'center',
  },
  title: {
    ...typography.h2,
    fontWeight: '700',
    marginBottom: spacing.sm,
    lineHeight: 30,
  },
  date: {
    ...typography.caption,
    marginBottom: spacing.lg,
    // Sin `capitalize`: son varias palabras. Ver `utils/textCase.ts`.
  },
  // El chip lo pinta `AppChip`; esto es solo su sitio en la columna.
  categoryChip: { marginTop: -spacing.sm, marginBottom: spacing.lg },
  image: {
    width: '100%',
    height: 200,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
  },
  body: {
    ...typography.body,
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
    ...typography.button,
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
    marginBottom: spacing.md,
    ...shadows.overlay,
  },
  // Los valores de color los pone quien lo usa con `themeColors(isDark).link`:
  // el azul de marca sobre fondo oscuro es 1,3:1.
  actionBtnSecondary: {
    borderWidth: 1.5,
    ...shadows.card,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});

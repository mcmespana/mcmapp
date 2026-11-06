import { logger } from '@/utils/logger';
import { capitalizeFirst } from '@/utils/textCase';
import { View, StyleSheet, Text, Linking, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@/components/ui/icons';
import { useTabNavigation } from '@/hooks/useTabNavigation';
import colors, { themeColors } from '@/constants/colors';
import { hexAlpha } from '@/utils/colorUtils';
import spacing from '@/constants/spacing';
import { radii, shadows } from '@/constants/uiStyles';
import typography from '@/constants/typography';
import { getEvent } from '@/constants/events';
import { routeForEventId } from '@/utils/notificationEventRoute';
import AppChip from '@/components/ui/AppChip';
import { categoryVisual } from '@/utils/notificationCategory';
import {
  notificationDate,
  type InboxNotification,
} from '@/utils/notificationsInbox';
import {
  getRouteLabel,
  getActionButtons,
  normalizeRoute,
} from './notificationDisplay';

/**
 * Detalle de una notificación: título, fecha, categoría, imagen, texto (el
 * largo si lo hay, si no el corto) y los destinos y botones de acción. Es el
 * contenido de la pantalla `/notifications/[id]`; ya no vive dentro de una hoja
 * ni de un modal, así que navegar a otra parte es simplemente navegar.
 */
export default function NotificationDetail({
  notification,
  isDark,
  bottomInset,
}: {
  notification: InboxNotification;
  isDark: boolean;
  bottomInset: number;
}) {
  const roles = themeColors(isDark);
  const { goToPath } = useTabNavigation();
  const date = notificationDate(notification);
  const routeInfo = notification.internalRoute
    ? getRouteLabel(notification.internalRoute)
    : null;
  const category = categoryVisual(notification.category);
  const actionButtons = getActionButtons(notification);
  // Deep link a un evento concreto: tiene prioridad sobre `internalRoute`.
  const eventRoute = notification.eventId
    ? routeForEventId(notification.eventId)
    : null;
  const eventTitle =
    eventRoute && notification.eventId
      ? getEvent(notification.eventId).title
      : null;

  const navigateTo = (route: string) => {
    try {
      goToPath(normalizeRoute(route));
    } catch (e) {
      logger.error('Error navegando desde la notificación:', e);
    }
  };

  const hasActions =
    !!notification.internalRoute || !!eventRoute || actionButtons.length > 0;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingBottom: bottomInset + spacing.xl },
      ]}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator
    >
      {notification.icon && (
        <Image
          source={{ uri: notification.icon }}
          style={styles.icon}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      )}

      <Text style={[styles.title, { color: roles.text }]}>
        {notification.title}
      </Text>

      <Text style={[styles.date, { color: roles.textSecondary }]}>
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
          style={styles.categoryChip}
        />
      )}

      {notification.imageUrl && (
        <Image
          source={{ uri: notification.imageUrl }}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
        />
      )}

      <Text style={[styles.body, { color: roles.text }]}>
        {notification.bodyLong || notification.body}
      </Text>

      {hasActions && (
        <View style={[styles.divider, { backgroundColor: roles.separator }]} />
      )}

      {eventRoute && (
        <DestinationButton
          icon="event"
          label={eventTitle ? `Ir a ${eventTitle}` : 'Ir al evento'}
          color={roles.link}
          onPress={() => navigateTo(eventRoute)}
        />
      )}

      {notification.internalRoute && (
        <DestinationButton
          icon={(routeInfo?.icon ?? 'launch') as never}
          label={routeInfo ? `Ir a ${routeInfo.label}` : 'Abrir sección'}
          color={roles.link}
          onPress={() => navigateTo(notification.internalRoute!)}
        />
      )}

      {/* Botones de acción (hasta 3): el primero destaca como primario y los
          siguientes van en estilo secundario. */}
      {actionButtons.map((button, idx) => (
        <PressableFeedback
          key={`${button.url}-${idx}`}
          style={[
            styles.actionBtn,
            idx === 0
              ? { backgroundColor: colors.primary }
              : {
                  backgroundColor: hexAlpha(roles.link, '12'),
                  borderColor: roles.link,
                  borderWidth: StyleSheet.hairlineWidth * 2,
                },
          ]}
          onPress={() => {
            if (button.isInternal) navigateTo(button.url);
            else Linking.openURL(button.url).catch(logger.error);
          }}
          accessibilityRole="button"
          accessibilityLabel={button.text}
        >
          <Text
            style={[
              styles.actionBtnText,
              { color: idx === 0 ? '#fff' : roles.link },
            ]}
          >
            {button.text}
          </Text>
          <MaterialIcons
            name={button.isInternal ? 'chevron-right' : 'open-in-new'}
            size={18}
            color={idx === 0 ? '#fff' : roles.link}
          />
        </PressableFeedback>
      ))}
    </ScrollView>
  );
}

function DestinationButton({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <PressableFeedback
      style={[styles.routeBtn, { borderColor: color }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <MaterialIcons name={icon} size={20} color={color} />
      <Text style={[styles.routeBtnText, { color }]}>{label}</Text>
      <MaterialIcons name="chevron-right" size={20} color={color} />
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingTop: spacing.md },
  icon: {
    width: 64,
    height: 64,
    borderRadius: radii.pillFull,
    marginBottom: spacing.md,
    alignSelf: 'center',
  },
  title: { ...typography.h2, fontWeight: '700', marginBottom: spacing.sm },
  // Sin `capitalize`: son varias palabras. Ver `utils/textCase.ts`.
  date: { ...typography.caption, marginBottom: spacing.lg },
  // El chip lo pinta `AppChip`; esto es solo su sitio en la columna.
  categoryChip: {
    alignSelf: 'flex-start',
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
  },
  body: { ...typography.body, lineHeight: 26, marginBottom: spacing.lg },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: spacing.lg },
  routeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    marginBottom: spacing.md,
  },
  routeBtnText: { flex: 1, ...typography.button, fontWeight: '600' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  actionBtnText: { ...typography.body, fontWeight: '700' },
});

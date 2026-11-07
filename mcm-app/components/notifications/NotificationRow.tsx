import React, { useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { PressableFeedback } from 'heroui-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import Swipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SharedValue } from 'react-native-reanimated';
import SwipeActionContent from '@/components/ui/SwipeActionContent';
import AppChip from '@/components/ui/AppChip';
import { MaterialIcons } from '@/components/ui/icons';
import colors, { themeColors, SwipeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { h } from '@/utils/haptics';
import { categoryVisual } from '@/utils/notificationCategory';
import {
  notificationDate,
  type InboxNotification,
} from '@/utils/notificationsInbox';
import { formatDate } from './notificationDisplay';
import useLargeText from '@/hooks/useLargeText';

const ICON_SIZE = 44;
const DOT_SIZE = 8;
const SWIPE_ACTION_WIDTH = 84;
// Distancia a la derecha que nunca se alcanza: desactiva ese sentido del arrastre.
const NO_RIGHT_DRAG = 10000;
// Área táctil de la acción de deslizar: ocupa todo el alto de la fila.
const SWIPE_RANGE: [number, number] = [-SWIPE_ACTION_WIDTH, 0];

/**
 * Una fila de la bandeja. Plana (sin tarjeta ni marco): lo no leído se dice con
 * un punto y el título en negrita, y lo demás —destino, botones de acción,
 * imagen— vive en el detalle, no aquí. Tocar abre el detalle.
 *
 * UN solo gesto, hacia la izquierda, que ALTERNA: en una no leída enseña
 * «Leída» y al soltar la marca; en una leída enseña «No leída» y al soltar la
 * devuelve a «Nuevas». Nunca hay un gesto que deshaga lo que acaba de hacer
 * otro. No se puede eliminar (decisión del propietario).
 */
function NotificationRow({
  notification,
  isRead,
  isDark,
  onOpen,
  onMarkRead,
  onMarkUnread,
}: {
  notification: InboxNotification;
  isRead: boolean;
  isDark: boolean;
  onOpen: (n: InboxNotification) => void;
  onMarkRead: (id: string) => void;
  onMarkUnread: (id: string) => void;
}) {
  const roles = themeColors(isDark);
  const unread = !isRead;
  // Letra del sistema grande: la hora pasa debajo del título y el título
  // puede ocupar varias líneas (a una sola se veían ~10 caracteres).
  const large = useLargeText();
  const swipeRef = useRef<SwipeableMethods>(null);
  const category = categoryVisual(notification.category);

  // Alterna según el estado de AHORA: soltar el arrastre (o pulsar el botón
  // mientras se arrastra) marca como leída una no leída y devuelve a «sin leer»
  // una leída. La fila se cierra sola.
  const toggle = () => {
    if (unread) {
      h.success();
      onMarkRead(notification.id);
    } else {
      h.select();
      onMarkUnread(notification.id);
    }
    swipeRef.current?.close();
  };

  const renderActions = (translation: SharedValue<number>) => (
    <TouchableOpacity
      style={[
        styles.action,
        { backgroundColor: unread ? SwipeColors.add : colors.primary },
      ]}
      onPress={toggle}
      // En web el botón de gesture-handler ya es un `<button>`: declarar también
      // el rol dentro pintaba otro `<button>` anidado (aviso de React DOM).
      accessibilityRole={Platform.OS === 'web' ? undefined : 'button'}
      accessibilityLabel={unread ? 'Marcar como leída' : 'Marcar como no leída'}
    >
      <SwipeActionContent
        translation={translation}
        inputRange={SWIPE_RANGE}
        outputRange={[1, 0]}
        property="scale"
        style={styles.actionContent}
      >
        <MaterialIcons
          name={unread ? 'check' : 'markunread'}
          size={22}
          color="#fff"
        />
        <Text style={styles.actionText}>{unread ? 'Leída' : 'No leída'}</Text>
      </SwipeActionContent>
    </TouchableOpacity>
  );

  return (
    <Swipeable
      ref={swipeRef}
      onSwipeableOpen={toggle}
      // Solo se arrastra hacia la IZQUIERDA. Un offset enorme hacia la derecha
      // hace que la fila no reclame ese gesto, y así el de «volver» del sistema
      // (deslizar desde el borde izquierdo, en iOS) no choca con la lista.
      dragOffsetFromLeft={NO_RIGHT_DRAG}
      renderRightActions={(_progress, translation) =>
        renderActions(translation)
      }
      rightThreshold={spacing.xl}
      overshootRight={false}
    >
      <PressableFeedback
        onPress={() => onOpen(notification)}
        accessibilityRole="button"
        accessibilityLabel={`${unread ? 'No leída: ' : ''}${notification.title}`}
        accessibilityActions={[
          unread
            ? { name: 'toggleRead', label: 'Marcar como leída' }
            : { name: 'toggleRead', label: 'Marcar como no leída' },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'toggleRead') toggle();
        }}
        style={[
          styles.row,
          {
            backgroundColor: roles.background,
            borderBottomColor: roles.separator,
          },
        ]}
      >
        <View style={styles.gutter}>
          {unread && (
            <View
              style={[styles.dot, { backgroundColor: roles.link }]}
              accessible={false}
            />
          )}
        </View>

        {notification.icon ? (
          <Image
            source={{ uri: notification.icon }}
            style={[styles.icon, { backgroundColor: roles.separator }]}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View
            style={[
              styles.icon,
              styles.iconFallback,
              { backgroundColor: roles.backgroundSunken },
            ]}
          >
            <MaterialIcons
              name={(category?.icon as never) ?? 'notifications-none'}
              size={22}
              color={roles.textSecondary}
            />
          </View>
        )}

        <View style={styles.content}>
          <View style={[styles.titleRow, large && styles.titleRowLarge]}>
            <Text
              style={[
                styles.title,
                { color: roles.text, fontWeight: unread ? '700' : '500' },
                large && styles.titleLarge,
              ]}
              numberOfLines={large ? 3 : 1}
            >
              {notification.title}
            </Text>
            <Text style={[styles.time, { color: roles.textSecondary }]}>
              {formatDate(notificationDate(notification))}
            </Text>
          </View>
          <Text
            style={[
              styles.body,
              { color: unread ? roles.text : roles.textSecondary },
            ]}
            numberOfLines={large ? 4 : 2}
          >
            {notification.body}
          </Text>
          {category && (
            <AppChip
              label={category.label}
              color={category.color}
              icon={category.icon as never}
              style={styles.chip}
            />
          )}
        </View>
      </PressableFeedback>
    </Swipeable>
  );
}

export default React.memo(NotificationRow);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // Reserva fija para el punto: las filas leídas y no leídas alinean igual.
  gutter: {
    width: spacing.md,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: radii.pillFull },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: radii.pillFull,
    marginRight: spacing.md,
  },
  iconFallback: { alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: { ...typography.body, flex: 1 },
  titleRowLarge: { flexDirection: 'column', alignItems: 'flex-start', gap: 2 },
  titleLarge: { flex: undefined },
  time: { ...typography.footnote },
  body: { ...typography.subhead, marginTop: spacing.xs },
  chip: { alignSelf: 'flex-start', marginTop: spacing.sm },
  // El 100 % hace que las acciones ocupen el alto de la fila, no el de su icono.
  actions: { flexDirection: 'row', height: '100%' },
  action: {
    width: SWIPE_ACTION_WIDTH,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: { alignItems: 'center', justifyContent: 'center' },
  actionText: {
    ...typography.footnote,
    color: '#fff',
    fontWeight: '600',
    marginTop: spacing.xs,
  },
});

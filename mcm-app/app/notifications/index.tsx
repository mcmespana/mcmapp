import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useNotificationsInbox } from '@/hooks/useNotificationsInbox';
import { h } from '@/utils/haptics';
import { confirmAsync } from '@/utils/confirmDialog';
import { MaterialIcons } from '@/components/ui/icons';
import {
  groupByReadState,
  notificationDetailHref,
  toRows,
  type InboxNotification,
  type InboxRow,
} from '@/utils/notificationsInbox';
import EmptyState from '@/components/ui/EmptyState';
import ListSkeleton from '@/components/ListSkeleton';
import SegmentedControl from '@/components/ui/SegmentedControl';
import NotificationPermissionBanner from '@/components/NotificationPermissionBanner';
import NotificationRow from '@/components/notifications/NotificationRow';

type Filter = 'unread' | 'all';

/**
 * La bandeja. Nada se borra: lo sin leer va arriba («Nuevas») y lo leído debajo
 * («Anteriores»). Si hay algo sin leer se abre en «Sin leer» (con «Todas» a un
 * toque); si no queda nada sin leer, salen directamente todas. Tocar una fila
 * abre su detalle (`/notifications/[id]`), que la marca como leída; «Marcar
 * todas» está en la cabecera, con texto, y solo aparece si hay algo sin leer.
 */
export default function NotificationsScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const roles = themeColors(isDark);
  const insets = useSafeAreaInsets();
  const inbox = useNotificationsInbox();
  // `null` = la persona aún no ha elegido: manda el estado de la bandeja.
  const [chosen, setChosen] = useState<Filter | null>(null);

  const hasUnread = inbox.unreadCount > 0;
  // Sin nada sin leer no hay nada que filtrar: siempre «Todas».
  const filter: Filter = hasUnread ? (chosen ?? 'unread') : 'all';

  const rows = useMemo(() => {
    const groups = groupByReadState(inbox.items, inbox.isRead);
    return toRows(
      filter === 'unread' ? groups.filter((g) => g.key === 'new') : groups,
    );
  }, [filter, inbox.items, inbox.isRead]);

  const open = useCallback((n: InboxNotification) => {
    h.tap();
    router.push(notificationDetailHref(n.id) as any);
  }, []);

  const { markRead, markUnread, isRead } = inbox;

  // Si se llegó por un enlace directo no hay nada debajo: se va a Inicio.
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)' as any);
  }, []);

  // «Marcar todas» es un doble tick en la cabecera y pide confirmar: es un gesto
  // de un toque que afecta a toda la lista.
  const confirmMarkAll = useCallback(async () => {
    const ok = await confirmAsync({
      title: 'Marcar todas como leídas',
      message: `${inbox.unreadCount === 1 ? 'Se marcará la notificación sin leer' : `Se marcarán las ${inbox.unreadCount} notificaciones sin leer`}. No se borra nada.`,
      confirmLabel: 'Sí, marcar todas',
    });
    if (!ok) return;
    h.success();
    inbox.markAllRead();
  }, [inbox]);

  const renderItem = useCallback(
    ({ item }: { item: InboxRow }) =>
      item.type === 'header' ? (
        <Text
          style={[styles.sectionLabel, { color: roles.textSecondary }]}
          accessibilityRole="header"
        >
          {item.title}
        </Text>
      ) : (
        <NotificationRow
          notification={item.notification}
          isRead={isRead(item.notification)}
          isDark={isDark}
          onOpen={open}
          onMarkRead={markRead}
          onMarkUnread={markUnread}
        />
      ),
    [roles.textSecondary, isRead, isDark, open, markRead, markUnread],
  );

  const header = (
    <View>
      <NotificationPermissionBanner placement="notifications" />
      {hasUnread && (
        <View style={styles.filter}>
          <SegmentedControl<Filter>
            options={[
              { value: 'unread', label: `Sin leer (${inbox.unreadCount})` },
              { value: 'all', label: 'Todas' },
            ]}
            value={filter}
            onChange={setChosen}
          />
        </View>
      )}
    </View>
  );

  return (
    <View
      style={[styles.container, { backgroundColor: Colors[scheme].background }]}
    >
      <Stack.Screen
        options={{
          // La lista es la primera pantalla de su propia pila, así que el
          // sistema no pone «volver»: sin esto solo quedaba el gesto.
          headerLeft: () => (
            <PressableFeedback
              onPress={goBack}
              accessibilityRole="button"
              accessibilityLabel="Volver"
              hitSlop={spacing.sm}
            >
              <MaterialIcons
                name="chevron-left"
                size={30}
                color={Colors[scheme].text}
              />
            </PressableFeedback>
          ),
          headerRight: () =>
            hasUnread ? (
              <PressableFeedback
                onPress={confirmMarkAll}
                accessibilityRole="button"
                accessibilityLabel="Marcar todas como leídas"
                hitSlop={spacing.sm}
              >
                <MaterialIcons name="done-all" size={24} color={roles.link} />
              </PressableFeedback>
            ) : null,
        }}
      />

      {inbox.loading ? (
        <ListSkeleton
          isDark={isDark}
          rows={6}
          rowHeight={72}
          label="Cargando notificaciones"
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          renderItem={renderItem}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-none"
              title="No hay notificaciones"
              subtitle="Aquí aparecerán tus notificaciones cuando las tengas."
            />
          }
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}
          refreshControl={
            <RefreshControl
              refreshing={inbox.refreshing}
              onRefresh={inbox.refresh}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filter: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sectionLabel: {
    ...typography.sectionLabel,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
});

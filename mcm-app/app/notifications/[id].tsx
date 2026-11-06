import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { h } from '@/utils/haptics';
import { isOlderThanAutoRead } from '@/utils/notificationsInbox';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useNotificationsInbox } from '@/hooks/useNotificationsInbox';
import EmptyState from '@/components/ui/EmptyState';
import ListSkeleton from '@/components/ListSkeleton';
import NotificationDetail from '@/components/notifications/NotificationDetail';

// Al llegar por una push, la copia local se guarda justo DESPUÉS de navegar:
// si no está a la primera, se reintenta un par de veces antes de decir que no existe.
const RETRY_MS = 600;
const MAX_RETRIES = 4;

/** Detalle de una notificación. Al abrirse la marca como leída. */
export default function NotificationDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();
  const inbox = useNotificationsInbox();
  const notification = inbox.findById(id);
  const markedRef = useRef<string | null>(null);

  const { markRead, markUnread, refresh, isRead } = inbox;
  const roles = themeColors(isDark);
  // Las de más de 60 días se dan por leídas por antigüedad: no se pueden devolver.
  const canMarkUnread = !!notification && !isOlderThanAutoRead(notification);

  // Marcar como leída: una sola vez por notificación abierta.
  useEffect(() => {
    if (!notification || markedRef.current === notification.id) return;
    markedRef.current = notification.id;
    if (!isRead(notification)) markRead(notification.id);
  }, [notification, isRead, markRead]);

  // Reintentos si aún no está en el historial (llegada por push).
  useEffect(() => {
    if (notification || inbox.loading) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      refresh();
      if (tries >= MAX_RETRIES) clearInterval(timer);
    }, RETRY_MS);
    return () => clearInterval(timer);
  }, [notification, inbox.loading, refresh]);

  const onMarkUnread = async () => {
    if (!notification) return;
    h.select();
    // Como en Mail: se marca y se vuelve a la lista, donde ya sale en «Nuevas».
    router.back();
    await markUnread(notification.id);
  };

  return (
    <View
      style={[styles.container, { backgroundColor: Colors[scheme].background }]}
    >
      <Stack.Screen
        options={{
          headerRight: () =>
            canMarkUnread ? (
              <PressableFeedback
                onPress={onMarkUnread}
                accessibilityRole="button"
                accessibilityLabel="Marcar como no leída"
                hitSlop={spacing.sm}
              >
                <Text style={[styles.action, { color: roles.link }]}>
                  No leída
                </Text>
              </PressableFeedback>
            ) : null,
        }}
      />
      {notification ? (
        <NotificationDetail
          notification={notification}
          isDark={isDark}
          bottomInset={insets.bottom}
        />
      ) : inbox.loading ? (
        <ListSkeleton
          isDark={isDark}
          rows={3}
          rowHeight={96}
          label="Cargando notificación"
        />
      ) : (
        <EmptyState
          icon="notifications-off"
          title="Esta notificación ya no está"
          subtitle="Puede que ya no esté disponible."
          actionLabel="Volver"
          onAction={() => router.back()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  action: { ...typography.button, fontWeight: '600' },
});

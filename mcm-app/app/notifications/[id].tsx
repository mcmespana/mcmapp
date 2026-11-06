import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useNavigation } from 'expo-router/react-navigation';
import { PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@/components/ui/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';
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
  const navigation = useNavigation();
  // ¿Es la ÚNICA pantalla de su pila? Pasa cuando se llega directo, p. ej. al
  // tocar una push o la tarjeta de Inicio: el sistema no pone «volver» porque
  // no hay nada debajo EN ESTA PILA. Se pone una flecha propia que hace lo mismo
  // que el gesto de borde: volver a donde estabas (o a Inicio si no hay nada).
  const alone = (navigation.getState()?.routes.length ?? 0) <= 1;

  const { markRead, refresh, isRead } = inbox;

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

  return (
    <View
      style={[styles.container, { backgroundColor: Colors[scheme].background }]}
    >
      {alone && (
        <Stack.Screen
          options={{
            headerLeft: () => (
              <PressableFeedback
                onPress={() =>
                  router.canGoBack()
                    ? router.back()
                    : router.replace('/(tabs)' as never)
                }
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
          }}
        />
      )}
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

const styles = StyleSheet.create({ container: { flex: 1 } });

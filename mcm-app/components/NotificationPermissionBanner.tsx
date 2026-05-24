// components/NotificationPermissionBanner.tsx
//
// Banner que invita a activar las notificaciones cuando el usuario aún no las
// ha concedido (estados `undetermined` y `denied`). Se descarta durante 7 días.
//
// - undetermined → CTA dispara el prompt nativo (Notifications.requestPermissionsAsync)
// - denied       → CTA abre Ajustes del sistema (Linking.openSettings)
// - granted / provisional → no se muestra
// - web → no se muestra
//
// Tras concederse en cualquier flujo (en-app o desde Ajustes al volver al
// foreground), se llama a `tryRegisterPushToken()` para registrar el token
// sin esperar al siguiente arranque.
import React, { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  AppStateStatus,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import colors, { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import { radii } from '@/constants/uiStyles';
import { hexAlpha } from '@/utils/colorUtils';
import { useColorScheme } from '@/hooks/useColorScheme';
import { tryRegisterPushToken } from '@/notifications/usePushNotifications';

const DISMISSED_KEY = '@mcm_notif_permission_banner_dismissed_at';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

type Status = 'loading' | 'granted' | 'denied' | 'undetermined' | 'hidden';

async function readPermissionStatus(): Promise<Exclude<Status, 'loading'>> {
  try {
    const res = (await Notifications.getPermissionsAsync()) as any;
    if (res?.granted) return 'granted';
    // iOS provisional: notificaciones silenciosas concedidas implícitamente
    if (res?.ios?.status === 3 /* provisional */) return 'granted';
    if (res?.status === 'denied' || res?.canAskAgain === false) return 'denied';
    return 'undetermined';
  } catch {
    return 'hidden';
  }
}

async function isWithinCooldown(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < COOLDOWN_MS;
  } catch {
    return false;
  }
}

export default function NotificationPermissionBanner({
  placement = 'home',
}: {
  placement?: 'home' | 'notifications';
}) {
  const scheme = useColorScheme() || 'light';
  const theme = Colors[scheme];
  const [status, setStatus] = useState<Status>('loading');

  const refresh = useCallback(async () => {
    if (Platform.OS === 'web') {
      setStatus('hidden');
      return;
    }
    const perm = await readPermissionStatus();
    if (perm === 'granted' || perm === 'hidden') {
      setStatus(perm);
      return;
    }
    if (await isWithinCooldown()) {
      setStatus('hidden');
      return;
    }
    setStatus(perm);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Reconsultar al volver al foreground: cubre el caso de "vuelvo de Ajustes
  // tras conceder permisos" sin tener que reiniciar la app.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const handleActivate = useCallback(async () => {
    if (status === 'undetermined') {
      try {
        const res = (await Notifications.requestPermissionsAsync()) as any;
        if (res?.granted) {
          // El usuario acaba de aceptar dentro de la app: registramos el
          // token sin esperar al siguiente arranque.
          tryRegisterPushToken().catch(() => {});
          setStatus('granted');
          return;
        }
      } catch {}
      // Si tras pedirlo no quedó concedido (p. ej. denegó o ya no se puede
      // volver a preguntar), refrescamos para mostrar la variante "Ajustes".
      await refresh();
      return;
    }
    // status === 'denied' → abrir Ajustes del sistema
    try {
      await Linking.openSettings();
    } catch {}
  }, [status, refresh]);

  const handleDismiss = useCallback(async () => {
    try {
      await AsyncStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {}
    setStatus('hidden');
  }, []);

  if (status === 'loading' || status === 'hidden' || status === 'granted') {
    return null;
  }

  const accentColor = scheme === 'dark' ? colors.info : colors.primary;
  const ctaLabel = status === 'denied' ? 'Abrir Ajustes' : 'Activar';

  const isNotifications = placement === 'notifications';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: hexAlpha(accentColor, '12'),
          borderColor: hexAlpha(accentColor, '30'),
          marginHorizontal: isNotifications ? spacing.md : 0,
          marginTop: isNotifications ? spacing.sm : 0,
          marginBottom: isNotifications ? 0 : spacing.md,
        },
      ]}
      accessibilityRole="alert"
    >
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: hexAlpha(accentColor, '18') },
        ]}
      >
        <MaterialIcons
          name="notifications-active"
          size={20}
          color={accentColor}
        />
      </View>
      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: theme.text }]}>
          Activa las notificaciones
        </Text>
        <Text style={[styles.body, { color: theme.icon }]} numberOfLines={3}>
          No te pierdas nada. La app funciona mejor con avisos en tiempo real.
        </Text>
        <TouchableOpacity
          onPress={handleActivate}
          style={[styles.cta, { backgroundColor: hexAlpha(accentColor, '18') }]}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
        >
          <Text style={[styles.ctaText, { color: accentColor }]}>
            {ctaLabel}
          </Text>
          <MaterialIcons
            name={status === 'denied' ? 'open-in-new' : 'arrow-forward'}
            size={14}
            color={accentColor}
          />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        onPress={handleDismiss}
        style={styles.close}
        accessibilityRole="button"
        accessibilityLabel="Descartar"
        hitSlop={8}
      >
        <MaterialIcons name="close" size={18} color={theme.icon} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm + 4,
    paddingRight: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  } as ViewStyle,
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  } as ViewStyle,
  textBlock: {
    flex: 1,
    gap: 4,
  } as ViewStyle,
  title: {
    fontSize: 13,
    fontWeight: '700',
  } as TextStyle,
  body: {
    fontSize: 11,
    lineHeight: 15,
    opacity: 0.85,
  } as TextStyle,
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: spacing.xs,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
  } as ViewStyle,
  ctaText: {
    fontSize: 12,
    fontWeight: '700',
  } as TextStyle,
  close: {
    padding: 2,
    marginLeft: 2,
  } as ViewStyle,
});

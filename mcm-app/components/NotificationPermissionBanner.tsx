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
import { MaterialIcons } from '@/components/ui/icons';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import colors, { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import { radii } from '@/constants/uiStyles';
import { hexAlpha } from '@/utils/colorUtils';
import { useColorScheme } from '@/hooks/useColorScheme';
import { tryRegisterPushToken } from '@/notifications/usePushNotifications';
import typography from '@/constants/typography';

const DISMISSED_KEY = '@mcm_notif_permission_banner_dismissed_at';
/**
 * La portada del área de Comunica (plan 08) lleva su propio descarte:
 * descartarlo en Inicio no lo esconde allí, ni al revés.
 */
const COMUNICA_DISMISSED_KEY = '@mcm_notif_permission_banner_comunica_at';

type Placement = 'home' | 'notifications' | 'comunica';
const dismissKey = (placement: Placement) =>
  placement === 'comunica' ? COMUNICA_DISMISSED_KEY : DISMISSED_KEY;

/** Lo que dice el banner en cada sitio. */
const COPY: Record<'default' | 'comunica', { title: string; body: string }> = {
  default: {
    title: 'Activa las notificaciones',
    body: 'No te pierdas nada. La app funciona mejor con avisos en tiempo real.',
  },
  comunica: {
    title: 'Activa los avisos',
    body: 'Te recordamos pasar lista y te avisamos si una lista no se ha subido.',
  },
};
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

async function isWithinCooldown(placement: Placement): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(dismissKey(placement));
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < COOLDOWN_MS;
  } catch {
    return false;
  }
}

/**
 * Qué variante del banner toca mostrar. Solo CALCULA: no toca estado de React,
 * así que sirve tanto para la consulta inicial como para refrescar a mano.
 */
async function resolveStatus(placement: Placement): Promise<Status> {
  if (Platform.OS === 'web') return 'hidden';
  const perm = await readPermissionStatus();
  if (perm === 'granted' || perm === 'hidden') return perm;
  if (await isWithinCooldown(placement)) return 'hidden';
  return perm;
}

export default function NotificationPermissionBanner({
  placement = 'home',
  accentColor: accentOverride,
}: {
  placement?: Placement;
  /** El acento del territorio en el que se pinta (Comunica: su violeta). */
  accentColor?: string;
}) {
  const scheme = useColorScheme() || 'light';
  const theme = Colors[scheme];
  // En web no hay permisos de push que pedir, así que el banner no se muestra
  // nunca: se sabe desde el primer render y no hace falta consultar nada.
  const [status, setStatus] = useState<Status>(
    Platform.OS === 'web' ? 'hidden' : 'loading',
  );

  const refresh = useCallback(async () => {
    setStatus(await resolveStatus(placement));
  }, [placement]);

  // Consulta inicial, y otra al volver al foreground: cubre el caso de "vuelvo
  // de Ajustes tras conceder permisos" sin tener que reiniciar la app.
  useEffect(() => {
    let alive = true;
    const apply = () => {
      resolveStatus(placement).then((next) => {
        if (alive) setStatus(next);
      });
    };
    apply();
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') apply();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [placement]);

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
      await AsyncStorage.setItem(dismissKey(placement), String(Date.now()));
    } catch {}
    setStatus('hidden');
  }, [placement]);

  if (status === 'loading' || status === 'hidden' || status === 'granted') {
    return null;
  }

  const accentColor =
    accentOverride ?? (scheme === 'dark' ? colors.info : colors.primary);
  const copy = COPY[placement === 'comunica' ? 'comunica' : 'default'];
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
          // En el área va dentro de `AreaScreen`, que ya separa los bloques.
          marginBottom:
            isNotifications || placement === 'comunica' ? 0 : spacing.md,
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
        <Text style={[styles.title, { color: theme.text }]}>{copy.title}</Text>
        <Text style={[styles.body, { color: theme.icon }]} numberOfLines={3}>
          {copy.body}
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
    borderRadius: radii.xl,
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
    ...typography.caption,
    fontWeight: '700',
  } as TextStyle,
  body: {
    ...typography.micro,
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
    borderRadius: radii.xl,
  } as ViewStyle,
  ctaText: {
    ...typography.footnote,
    fontWeight: '700',
  } as TextStyle,
  close: {
    padding: 2,
    marginLeft: 2,
  } as ViewStyle,
});

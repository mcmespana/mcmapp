import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Cuenta taps consecutivos dentro de una ventana de tiempo. Cuando se alcanza
 * `tapsRequired`, dispara `onUnlock`. La ventana se reinicia si el usuario tarda
 * demasiado entre taps.
 *
 * A partir del 4º tap se emite haptic con intensidad creciente para señalar al
 * usuario que está pasando algo y vale la pena seguir tocando.
 */
export interface UseSecretTapOptions {
  tapsRequired?: number;
  /** Tiempo máximo entre taps (ms) antes de reiniciar la cuenta. */
  resetAfterMs?: number;
  /** Si false, no se emite ningún haptic intermedio. */
  haptics?: boolean;
}

export interface UseSecretTapApi {
  /** Conectar al `onPress` del elemento objetivo. */
  onPress: () => void;
  /** Resetear el contador manualmente (p.ej. al desmontar el modal). */
  reset: () => void;
}

export function useSecretTap(
  onUnlock: () => void,
  options: UseSecretTapOptions = {},
): UseSecretTapApi {
  const { tapsRequired = 7, resetAfterMs = 1500, haptics = true } = options;
  const countRef = useRef(0);
  const lastTapRef = useRef(0);

  const reset = useCallback(() => {
    countRef.current = 0;
    lastTapRef.current = 0;
  }, []);

  const triggerHaptic = useCallback(
    (style: Haptics.ImpactFeedbackStyle) => {
      if (!haptics || Platform.OS === 'web') return;
      Haptics.impactAsync(style).catch(() => {});
    },
    [haptics],
  );

  const onPress = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current > resetAfterMs) {
      countRef.current = 0;
    }
    lastTapRef.current = now;
    countRef.current += 1;

    // Haptic ramp creciente desde el 4º tap — pista creciente de que algo viene.
    if (countRef.current >= 4 && countRef.current < tapsRequired) {
      const remaining = tapsRequired - countRef.current;
      if (remaining <= 1) triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      else if (remaining <= 2)
        triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
      else triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    }

    if (countRef.current >= tapsRequired) {
      reset();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      }
      onUnlock();
    }
  }, [onUnlock, tapsRequired, resetAfterMs, triggerHaptic, reset]);

  return { onPress, reset };
}

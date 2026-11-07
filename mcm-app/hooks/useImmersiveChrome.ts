/**
 * Controles que se apagan solos, como en un lector o un reproductor: a la
 * vista al entrar y con cada toque (`poke`); a los `delay` ms sin tocar nada
 * se desvanecen, para que no tapen la letra mientras se toca. Con lector de
 * pantalla no se esconden nunca.
 *
 * `style` es la opacidad de los controles; `dimStyle`, la de lo que no debe
 * desaparecer del todo (el botón de cerrar), que solo se atenúa.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { durations } from '@/constants/animations';

export const IMMERSIVE_HIDE_MS = 3500;
/** Opacidad de lo que solo se atenúa con los controles escondidos. */
const DIM = 0.35;

export function useImmersiveChrome(delay = IMMERSIVE_HIDE_MS) {
  const [visible, setVisible] = useState(true);
  const [screenReader, setScreenReader] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), delay);
  }, [delay]);

  const poke = useCallback(() => {
    setVisible(true);
    schedule();
  }, [schedule]);

  useEffect(() => {
    schedule();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [schedule]);

  useEffect(() => {
    // En web, react-native-web contesta siempre que sí (no lo puede saber):
    // los controles no se escondían nunca.
    if (Platform.OS === 'web') return;
    let alive = true;
    Promise.resolve(AccessibilityInfo.isScreenReaderEnabled?.())
      .then((on) => {
        if (alive) setScreenReader(!!on);
      })
      .catch(() => {});
    let sub: { remove: () => void } | undefined;
    try {
      sub = AccessibilityInfo.addEventListener(
        'screenReaderChanged',
        setScreenReader,
      );
    } catch {
      /* web sin soporte: da igual */
    }
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);

  const shown = visible || screenReader;
  const anim = useSharedValue(1);
  useEffect(() => {
    anim.set(
      withTiming(shown ? 1 : 0, {
        duration: shown ? durations.quick : durations.slow,
      }),
    );
  }, [shown, anim]);

  const style = useAnimatedStyle(() => ({ opacity: anim.get() }));
  const dimStyle = useAnimatedStyle(() => ({
    opacity: DIM + (1 - DIM) * anim.get(),
  }));

  return { shown, poke, style, dimStyle };
}

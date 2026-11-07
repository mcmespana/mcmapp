// components/ui/ComunicaTopProgress.tsx
// Hilo de progreso para las navegaciones POSTERIORES a la primera carga del
// WebView de Comunica. La portada completa (`ComunicaLoader`) solo se justifica
// al entrar; al pulsar un enlace dentro del portal basta una barra fina arriba
// (patrón navegador) para no tapar lo que el usuario ya estaba viendo.

import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import brand from '@/constants/colors';
import { durations, reaEasings } from '@/constants/animations';

interface ComunicaTopProgressProps {
  scheme: 'light' | 'dark';
  /** Progreso de carga del WebView (0-1). */
  progress: number;
  visible: boolean;
  /** Offset superior (alto del notch) para no quedar bajo la barra glass. */
  top?: number;
}

export default function ComunicaTopProgress({
  scheme,
  progress,
  visible,
  top = 0,
}: ComunicaTopProgressProps) {
  const accent = scheme === 'dark' ? brand.info : brand.primary;
  const width = useSharedValue(0.02);
  const opacity = useSharedValue(0);

  useEffect(() => {
    width.set(
      withTiming(Math.max(0.02, Math.min(progress, 1)), {
        duration: 300,
        easing: reaEasings.standard,
      }),
    );
  }, [width, progress]);

  useEffect(() => {
    opacity.set(
      withTiming(
        visible ? 1 : 0,
        {
          duration: visible ? 120 : durations.slow,
          easing: reaEasings.standard,
        },
        (finished) => {
          'worklet';
          // Al acabar de irse, el hilo vuelve a cero para que la próxima carga
          // no arranque desde donde se quedó la anterior.
          if (finished && !visible) width.set(0.02);
        },
      ),
    );
  }, [opacity, visible, width]);

  const trackStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: width.get() }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.track, { top }, trackStyle]}
    >
      <Animated.View
        style={[styles.fill, { backgroundColor: accent }, fillStyle]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    zIndex: 15,
  },
  fill: {
    width: '100%',
    height: '100%',
    // Crece desde el borde izquierdo en vez de desde el centro.
    transformOrigin: 'left',
  },
});

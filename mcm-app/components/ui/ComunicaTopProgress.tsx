// components/ui/ComunicaTopProgress.tsx
// Hilo de progreso para las navegaciones POSTERIORES a la primera carga del
// WebView de Comunica. La portada completa (`ComunicaLoader`) solo se justifica
// al entrar; al pulsar un enlace dentro del portal basta una barra fina arriba
// (patrón navegador) para no tapar lo que el usuario ya estaba viendo.

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import brand from '@/constants/colors';
import { durations, easings } from '@/constants/animations';

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
  const width = useRef(new Animated.Value(0.02)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: Math.max(0.02, Math.min(progress, 1)),
      duration: 300,
      easing: easings.standard,
      useNativeDriver: true,
    }).start();
  }, [width, progress]);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: visible ? 120 : durations.slow,
      easing: easings.standard,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) width.setValue(0.02);
    });
  }, [opacity, visible, width]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.track, { top, opacity }]}
    >
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: accent, transform: [{ scaleX: width }] },
        ]}
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

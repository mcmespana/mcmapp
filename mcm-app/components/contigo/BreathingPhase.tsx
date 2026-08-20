import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { reaEasings } from '@/constants/animations';

const BREATH_MS = 2100;

/**
 * "Para un momento..." breathing animation shown when entering the
 * Revisión screen. Inhale → exhale → inhale, then auto-dismiss.
 * Tap to skip.
 */
export function BreathingPhase({ onDone }: { onDone: () => void }) {
  // Con "reducir movimiento" los anillos no laten: el texto "Respira... /
  // Inspira..." se sigue turnando al mismo ritmo, así que el ejercicio de
  // respiración funciona igual sin el movimiento que marea. Esta pantalla es
  // contemplativa y puntual (entra a propósito al abrir Revisión), así que se
  // queda con opacidad y con el propio ciclo de la respiración: solo se quita
  // el latido de escala.
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.72);
  const [phaseLabel, setPhaseLabel] = React.useState<'inhale' | 'exhale'>(
    'inhale',
  );
  const finished = useRef(false);

  useEffect(() => {
    opacity.set(withTiming(1, { duration: 480 }));

    const breath = (to: number, label: 'inhale' | 'exhale') => {
      setPhaseLabel(label);
      if (reducedMotion) return;
      scale.set(
        withTiming(to, {
          duration: BREATH_MS,
          easing: reaEasings.cubic,
        }),
      );
    };

    // inhale (already at 0.72) → exhale ↑ → inhale ↓ → done
    breath(1.35, 'inhale');
    const t1 = setTimeout(() => breath(0.72, 'exhale'), BREATH_MS);
    const t2 = setTimeout(() => breath(1.35, 'inhale'), BREATH_MS * 2);
    const t3 = setTimeout(() => fade(), 5000);
    return () => {
      [t1, t2, t3].forEach(clearTimeout);
      finished.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  const fade = () => {
    if (finished.current) return;
    finished.current = true;
    opacity.set(
      withTiming(0, { duration: 380 }, () => {
        'worklet';
        scheduleOnRN(onDone);
      }),
    );
  };

  // Los tres anillos siguen la MISMA respiración a distinta escala; antes eran
  // `Animated.multiply(scale, k)`.
  const rootStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() * 1.35 }],
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));
  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() * 0.84 }],
  }));

  return (
    <Animated.View pointerEvents="auto" style={[styles.root, rootStyle]}>
      <TouchableWithoutFeedback onPress={fade}>
        <View style={styles.touch}>
          <View style={styles.headWrap}>
            <Text style={styles.title}>Para un momento...</Text>
            <Text style={styles.subtitle}>
              Haz un STOP antes de revisar tu día
            </Text>
          </View>
          <View style={styles.ringStack}>
            <Animated.View style={[styles.glow, glowStyle]} />
            <Animated.View style={[styles.ring2, ring2Style]} />
            <Animated.View style={[styles.ring1, ring1Style]}>
              <Text style={styles.phaseText}>
                {phaseLabel === 'inhale' ? 'Respira...' : 'Inspira...'}
              </Text>
            </Animated.View>
          </View>
          <Text style={styles.hint}>Toca para continuar</Text>
        </View>
      </TouchableWithoutFeedback>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#181309',
    zIndex: 400,
  },
  touch: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headWrap: { alignItems: 'center', marginBottom: 56 },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#F0E8D8',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(240,232,216,0.36)',
    marginTop: 8,
  },
  ringStack: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(196,146,42,0.10)',
  },
  ring2: {
    position: 'absolute',
    width: 164,
    height: 164,
    borderRadius: 82,
    borderWidth: 1,
    borderColor: 'rgba(196,146,42,0.22)',
  },
  ring1: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 1.5,
    borderColor: 'rgba(196,146,42,0.52)',
    backgroundColor: 'rgba(196,146,42,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(240,232,216,0.65)',
    letterSpacing: 0.4,
  },
  hint: {
    marginTop: 64,
    fontSize: 10,
    color: 'rgba(240,232,216,0.22)',
    letterSpacing: 0.5,
  },
});

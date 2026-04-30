import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableWithoutFeedback,
  Animated,
  Easing,
} from 'react-native';

const BREATH_MS = 2100;

/**
 * "Para un momento..." breathing animation shown when entering the
 * Revisión screen. Inhale → exhale → inhale, then auto-dismiss.
 * Tap to skip.
 */
export function BreathingPhase({ onDone }: { onDone: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.72)).current;
  const [phaseLabel, setPhaseLabel] = React.useState<'inhale' | 'exhale'>(
    'inhale',
  );
  const finished = useRef(false);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 480,
      useNativeDriver: true,
    }).start();

    const breath = (to: number, label: 'inhale' | 'exhale') => {
      setPhaseLabel(label);
      Animated.timing(scale, {
        toValue: to,
        duration: BREATH_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start();
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
  }, []);

  const fade = () => {
    if (finished.current) return;
    finished.current = true;
    Animated.timing(opacity, {
      toValue: 0,
      duration: 380,
      useNativeDriver: true,
    }).start(() => onDone());
  };

  return (
    <Animated.View pointerEvents="auto" style={[styles.root, { opacity }]}>
      <TouchableWithoutFeedback onPress={fade}>
        <View style={styles.touch}>
          <View style={styles.headWrap}>
            <Text style={styles.title}>Para un momento...</Text>
            <Text style={styles.subtitle}>Respira antes de revisar tu día</Text>
          </View>
          <View style={styles.ringStack}>
            <Animated.View
              style={[
                styles.glow,
                { transform: [{ scale: Animated.multiply(scale, 1.35) }] },
              ]}
            />
            <Animated.View style={[styles.ring2, { transform: [{ scale }] }]} />
            <Animated.View
              style={[
                styles.ring1,
                { transform: [{ scale: Animated.multiply(scale, 0.84) }] },
              ]}
            >
              <Text style={styles.phaseText}>
                {phaseLabel === 'inhale' ? 'Inhala...' : 'Exhala...'}
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

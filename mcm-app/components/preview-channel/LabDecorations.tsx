import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

// Adornos de texto animados del "Laboratorio Alpha": el título que se mece,
// los destellos pulsantes y el ticker de frases rotativas. Extraído de
// PreviewChannelModal.

const FUN_PHRASES = [
  'Bienvenido al multiverso de las features por venir 🐛',
  'Eres oficialmente parte del equipo cool 😎',
  'Pueden caer novedades sin previo aviso 🪂',
  'Aquí se prueba antes de que el resto del mundo lo vea 🔭',
  'Versión: mañana. Estabilidad: quizás. 🤞',
  'Pacto firmado con tinta invisible. Indeleble. 🖋️',
  'Si algo se rompe, has cumplido tu misión 🎯',
  'Bienvenido al laboratorio. Cuidado con las pócimas. ⚗️',
];

export function WobblingTitle({ children }: { children: React.ReactNode }) {
  const wobble = useSharedValue(0);
  useEffect(() => {
    wobble.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 520, easing: Easing.inOut(Easing.quad) }),
        withTiming(-1, { duration: 520, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
    return () => cancelAnimation(wobble);
  }, [wobble]);
  const style = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${wobble.value * 2.5}deg` },
      { scale: 1 + Math.abs(wobble.value) * 0.04 },
    ],
  }));
  return (
    <Animated.Text style={[styles.title, style]}>{children}</Animated.Text>
  );
}

export function Sparkles() {
  const o0 = useSharedValue(0.4);
  const o1 = useSharedValue(0.4);
  const o2 = useSharedValue(0.4);
  const o3 = useSharedValue(0.4);
  useEffect(() => {
    const seq = () =>
      withRepeat(
        withSequence(
          withTiming(1, { duration: 460 }),
          withTiming(0.2, { duration: 460 }),
        ),
        -1,
        true,
      );
    o0.value = withDelay(0, seq());
    o1.value = withDelay(220, seq());
    o2.value = withDelay(440, seq());
    o3.value = withDelay(660, seq());
    return () => {
      cancelAnimation(o0);
      cancelAnimation(o1);
      cancelAnimation(o2);
      cancelAnimation(o3);
    };
  }, [o0, o1, o2, o3]);
  const a0 = useAnimatedStyle(() => ({ opacity: o0.value }));
  const a1 = useAnimatedStyle(() => ({ opacity: o1.value }));
  const a2 = useAnimatedStyle(() => ({ opacity: o2.value }));
  const a3 = useAnimatedStyle(() => ({ opacity: o3.value }));
  return (
    <View style={styles.sparklesRow} pointerEvents="none">
      <Animated.Text style={[styles.sparkle, a0]}>✦</Animated.Text>
      <Animated.Text style={[styles.sparkle, a1]}>✧</Animated.Text>
      <Animated.Text style={[styles.sparkle, a2]}>✦</Animated.Text>
      <Animated.Text style={[styles.sparkle, a3]}>✧</Animated.Text>
    </View>
  );
}

export function RotatingPhrases() {
  const [idx, setIdx] = useState(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    const id = setInterval(() => {
      opacity.value = withSequence(
        withTiming(0, { duration: 350 }),
        withTiming(1, { duration: 450 }),
      );
      setTimeout(() => {
        setIdx((p) => (p + 1) % FUN_PHRASES.length);
      }, 360);
    }, 4200);
    return () => clearInterval(id);
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.Text style={[styles.phrase, style]} numberOfLines={2}>
      {FUN_PHRASES[idx]}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 4 },
  },
  sparklesRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 4,
  },
  sparkle: {
    color: '#FFF',
    fontSize: 22,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 8,
  },
  phrase: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 13,
    fontWeight: '600',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 6,
    minHeight: 36,
  },
});

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { durations, reaEasings } from '@/constants/animations';

const DEFAULT_PARTICLES: { tx: number; ty: number; c: string }[] = [
  { tx: -70, ty: -80, c: '#FCD34D' },
  { tx: 70, ty: -80, c: '#60A5FA' },
  { tx: -100, ty: -20, c: '#F87171' },
  { tx: 100, ty: -20, c: '#34D399' },
  { tx: -80, ty: 60, c: '#A78BFA' },
  { tx: 80, ty: 60, c: '#FB923C' },
  { tx: 0, ty: -100, c: '#FDE68A' },
  { tx: -50, ty: 90, c: '#6EE7B7' },
  { tx: 50, ty: 90, c: '#93C5FD' },
  { tx: -110, ty: 30, c: '#FCA5A5' },
  { tx: 110, ty: 30, c: '#C4B5FD' },
  { tx: 0, ty: 110, c: '#FCD34D' },
];

/** Retardo entre partícula y partícula (era el `stagger` de RN Animated). */
const STAGGER_MS = 18;

interface CelebrationBurstProps {
  /** When true, plays the burst. Reset to false to be able to replay. */
  visible: boolean;
  /** Optional override of the particle palette + positions. */
  particles?: { tx: number; ty: number; c: string }[];
  /** Center emoji shown along with the burst. Defaults to ✨. */
  emoji?: string;
  /** Center emoji size. Defaults to 40. */
  emojiSize?: number;
}

/**
 * Burst of 12 colourful dots radiating from the centre with a scaling emoji.
 * Reanimated — no SVG, no extra dependencies. Corre en el hilo de UI, así que
 * no se entrecorta cuando JS está ocupado (que es justo lo que pasa al
 * publicar una reflexión o completar un hábito, cuando se dispara).
 *
 * Extracted from `components/contigo/CelebrationAnimation.tsx`. Use anywhere
 * a positive confirmation deserves a moment of joy: Wordle win, Reflexiones
 * publish, completed Contigo habit, etc.
 */
export default function CelebrationBurst({
  visible,
  particles = DEFAULT_PARTICLES,
  emoji = '✨',
  emojiSize = 40,
}: CelebrationBurstProps) {
  // Todo el burst se MONTA al hacerse visible y se desmonta al acabar, así que
  // cada pieza anima al montarse y no hace falta resetear nada a mano.
  if (!visible) return null;

  return (
    <View pointerEvents="none" style={styles.root}>
      {particles.map((p, i) => (
        <BurstParticle
          key={i}
          tx={p.tx}
          ty={p.ty}
          color={p.c}
          delay={i * STAGGER_MS}
        />
      ))}
      <BurstEmoji emoji={emoji} size={emojiSize} />
    </View>
  );
}

/**
 * Una partícula. Cada una tiene su propio `useSharedValue` porque los hooks no
 * se pueden llamar en un bucle de longitud variable — antes era un array de
 * `Animated.Value` guardado en un ref.
 */
function BurstParticle({
  tx,
  ty,
  color,
  delay,
}: {
  tx: number;
  ty: number;
  color: string;
  delay: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, {
        duration: durations.hero + 100,
        easing: reaEasings.bouncy,
      }),
    );
  }, [progress, delay]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.6, 1], [1, 1, 0]),
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [0, tx]) },
      { translateY: interpolate(progress.value, [0, 1], [0, ty]) },
      { scale: interpolate(progress.value, [0, 1], [0, 1.2]) },
    ],
  }));

  return (
    <Animated.View
      style={[styles.particle, { backgroundColor: color }, style]}
    />
  );
}

/** El emoji del centro: entra girando y creciendo, y se va encogiendo. */
function BurstEmoji({ emoji, size }: { emoji: string; size: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: durations.hero,
      easing: reaEasings.bouncy,
    });
  }, [progress]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.3, 0.7, 1], [0, 1, 1, 0]),
    transform: [
      { scale: interpolate(progress.value, [0, 0.7, 1], [0, 1.4, 0.8]) },
      { rotate: `${interpolate(progress.value, [0, 1], [-20, 5])}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.starWrap, style]}>
      <Text style={[styles.star, { fontSize: size }]}>{emoji}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 300,
  },
  particle: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  starWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: {},
});

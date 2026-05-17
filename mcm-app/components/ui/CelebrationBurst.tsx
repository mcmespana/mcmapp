import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { durations, easings } from '@/constants/animations';

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
 * Pure RN Animated — no SVG, no extra dependencies.
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
  const progress = useRef<Animated.Value[]>(
    particles.map(() => new Animated.Value(0)),
  ).current;
  const star = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      progress.forEach((p: Animated.Value) => p.setValue(0));
      star.setValue(0);
      return;
    }
    Animated.stagger(
      18,
      progress.map((p: Animated.Value) =>
        Animated.timing(p, {
          toValue: 1,
          duration: durations.hero + 100,
          easing: easings.bouncy,
          useNativeDriver: true,
        }),
      ),
    ).start();
    Animated.timing(star, {
      toValue: 1,
      duration: durations.hero,
      easing: easings.bouncy,
      useNativeDriver: true,
    }).start();
  }, [visible, progress, star]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={styles.root}>
      {particles.map((p, i) => {
        const v = progress[i];
        const tx = v.interpolate({
          inputRange: [0, 1],
          outputRange: [0, p.tx],
        });
        const ty = v.interpolate({
          inputRange: [0, 1],
          outputRange: [0, p.ty],
        });
        const scale = v.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1.2],
        });
        const opacity = v.interpolate({
          inputRange: [0, 0.6, 1],
          outputRange: [1, 1, 0],
        });
        return (
          <Animated.View
            key={i}
            style={[
              styles.particle,
              {
                backgroundColor: p.c,
                opacity,
                transform: [{ translateX: tx }, { translateY: ty }, { scale }],
              },
            ]}
          />
        );
      })}
      <Animated.View
        style={[
          styles.starWrap,
          {
            opacity: star.interpolate({
              inputRange: [0, 0.3, 0.7, 1],
              outputRange: [0, 1, 1, 0],
            }),
            transform: [
              {
                scale: star.interpolate({
                  inputRange: [0, 0.7, 1],
                  outputRange: [0, 1.4, 0.8],
                }),
              },
              {
                rotate: star.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['-20deg', '5deg'],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={[styles.star, { fontSize: emojiSize }]}>{emoji}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
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

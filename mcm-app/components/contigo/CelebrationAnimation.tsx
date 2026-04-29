import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated, Easing, View, Text } from 'react-native';

// Particle palette ported from the Contigo Redesign mockup (CelebrationBurst).
// 12 colourful dots burst outwards from the centre while a ✨ scales/rotates in.
const PARTICLES: { tx: number; ty: number; c: string }[] = [
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

const BURST_MS = 900;
const STAGGER_MS = 18;

export function CelebrationAnimation({
  visible,
}: {
  visible: boolean;
  isDark?: boolean;
}) {
  const progress = useRef(PARTICLES.map(() => new Animated.Value(0))).current;
  const star = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      progress.forEach((p) => p.setValue(0));
      star.setValue(0);
      return;
    }
    Animated.stagger(
      STAGGER_MS,
      progress.map((p) =>
        Animated.timing(p, {
          toValue: 1,
          duration: BURST_MS,
          easing: Easing.bezier(0.2, 0.8, 0.3, 1),
          useNativeDriver: true,
        }),
      ),
    ).start();
    Animated.timing(star, {
      toValue: 1,
      duration: 800,
      easing: Easing.bezier(0.2, 0.8, 0.3, 1),
      useNativeDriver: true,
    }).start();
  }, [visible, progress, star]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={styles.root}>
      {PARTICLES.map((p, i) => {
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
        <Text style={styles.star}>✨</Text>
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
  star: { fontSize: 40 },
});

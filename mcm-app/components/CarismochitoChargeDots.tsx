import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';

const DOT_SIZE = 10;
const DOT_GAP = 8;
const G_GLOW = '#5AE08A';
const G_DIM = 'rgba(90, 224, 138, 0.25)';

function Dot({ filled, index }: { filled: boolean; index: number }) {
  const scale = useSharedValue(filled ? 0.4 : 1);
  const opacity = useSharedValue(filled ? 0 : 0.25);

  useEffect(() => {
    if (filled) {
      // Al encenderse, el punto entra de golpe desde pequeño y transparente.
      scale.value = 0.4;
      opacity.value = 0.3;
      // `tension: 200, friction: 8` de RN Animated equivale a este muelle:
      // `stiffness` es la tensión y `damping` la fricción.
      scale.value = withSpring(1, { stiffness: 200, damping: 8, mass: 1 });
      opacity.value = withTiming(1, { duration: 150 });
    } else {
      opacity.value = withTiming(0.25, { duration: 300 });
      scale.value = 1;
    }
  }, [filled, scale, opacity, index]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          backgroundColor: filled ? G_GLOW : G_DIM,
          shadowColor: filled ? G_GLOW : 'transparent',
        },
        style,
      ]}
    />
  );
}

export default function CarismochitoChargeDots({
  count,
  total,
}: {
  count: number;
  total: number;
}) {
  // Los puntos se dibujan sobre la barra de pestañas flotante.
  const tabBarClearance = useTabBarClearance();
  const containerOpacity = useSharedValue(0);

  useEffect(() => {
    containerOpacity.value = withTiming(1, { duration: 200 });
  }, [containerOpacity]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.root, { bottom: tabBarClearance + 8 }, containerStyle]}
    >
      <View style={styles.row}>
        {Array.from({ length: total }).map((_, i) => (
          <Dot key={i} index={i} filled={i < count} />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9400,
    elevation: 55,
  },
  row: {
    flexDirection: 'row',
    gap: DOT_GAP,
    backgroundColor: 'rgba(6, 33, 15, 0.7)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(90, 224, 138, 0.3)',
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
});

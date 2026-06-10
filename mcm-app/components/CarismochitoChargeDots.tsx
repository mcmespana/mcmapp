import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DOT_SIZE = 10;
const DOT_GAP = 8;
const G_GLOW = '#5AE08A';
const G_DIM = 'rgba(90, 224, 138, 0.25)';

function Dot({ filled, index }: { filled: boolean; index: number }) {
  const scale = useRef(new Animated.Value(filled ? 0.4 : 1)).current;
  const opacity = useRef(new Animated.Value(filled ? 0 : 0.25)).current;

  useEffect(() => {
    if (filled) {
      scale.setValue(0.4);
      opacity.setValue(0.3);
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          tension: 200,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.timing(opacity, {
        toValue: 0.25,
        duration: 300,
        useNativeDriver: true,
      }).start();
      scale.setValue(1);
    }
  }, [filled, scale, opacity, index]);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          backgroundColor: filled ? G_GLOW : G_DIM,
          transform: [{ scale }],
          opacity,
          shadowColor: filled ? G_GLOW : 'transparent',
        },
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
  const insets = useSafeAreaInsets();
  const containerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(containerOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [containerOpacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.root,
        { bottom: insets.bottom + 80, opacity: containerOpacity },
      ]}
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

import React, { useRef, useEffect } from 'react';
import { StyleSheet, Animated, Easing } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const PARTICLES = Array.from({ length: 24 });

export function CelebrationAnimation({
  visible,
  isDark,
}: {
  visible: boolean;
  isDark: boolean;
}) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const particles = useRef(PARTICLES.map(() => new Animated.Value(0))).current;

  // Generate random data ONCE per render cycle so it's consistent during animation
  const particleConfigs = useRef(
    PARTICLES.map((_, i) => ({
      angleOffset: Math.random() * 20 - 10,
      distance: 70 + Math.random() * 100,
      size: 16 + Math.random() * 16,
      delay: Math.random() * 40,
      duration: 300 + Math.random() * 300,
      iconName: i % 2 === 0 ? 'star' : 'auto-awesome',
      color:
        i % 3 === 0
          ? '#FFD700'
          : i % 2 === 0
            ? '#4ECDC4'
            : isDark
              ? '#DAA520'
              : '#FF6B6B',
    })),
  ).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 110,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        ...particles.map((p, i) =>
          Animated.sequence([
            Animated.delay(particleConfigs[i].delay),
            Animated.timing(p, {
              toValue: 1,
              duration: particleConfigs[i].duration,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
        ),
      ]).start();

      const timer = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 400,
          easing: Easing.ease,
          useNativeDriver: true,
        }).start();
      }, 2000);

      return () => clearTimeout(timer);
    } else {
      scale.setValue(0);
      opacity.setValue(0);
      particles.forEach((p) => p.setValue(0));
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.checkOverlay,
        { opacity, zIndex: 99999, elevation: 99999 },
      ]}
      pointerEvents="none"
    >
      {/* The particles */}
      {particles.map((p, i) => {
        const config = particleConfigs[i];
        const baseAngle = (i * 360) / PARTICLES.length;
        const rad = ((baseAngle + config.angleOffset) * Math.PI) / 180;

        const moveX = p.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.cos(rad) * config.distance],
        });
        const moveY = p.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.sin(rad) * config.distance],
        });
        const pScale = p.interpolate({
          inputRange: [0, 0.4, 0.8, 1],
          outputRange: [0, 1.2, 0.8, 0],
        });
        const rotate = p.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${i % 2 === 0 ? 270 : -270}deg`],
        });

        return (
          <Animated.View
            key={`particle-${i}`}
            style={[
              StyleSheet.absoluteFill,
              {
                alignItems: 'center',
                justifyContent: 'center',
                transform: [
                  { translateX: moveX },
                  { translateY: moveY },
                  { scale: pScale },
                  { rotate },
                ],
              },
            ]}
          >
            <MaterialIcons
              name={config.iconName as any}
              size={config.size}
              color={config.color}
            />
          </Animated.View>
        );
      })}

      {/* The main bubble */}
      <Animated.View
        style={[
          styles.checkCircle,
          {
            backgroundColor: isDark
              ? 'rgba(218, 165, 32, 0.25)'
              : 'rgba(218, 165, 32, 0.15)',
            transform: [{ scale }],
            shadowColor: '#DAA520',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 20,
          },
        ]}
      >
        <MaterialIcons
          name="auto-awesome"
          size={56}
          color={isDark ? '#DAA520' : '#B8860B'}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  checkOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  checkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

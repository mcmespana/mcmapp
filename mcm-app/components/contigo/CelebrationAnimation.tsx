import React, { useRef, useEffect } from 'react';
import { StyleSheet, Animated, Easing, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// ── Three concentric rings for a layered burst ──
const RING_1 = Array.from({ length: 8 }); // Inner — fast gold burst
const RING_2 = Array.from({ length: 12 }); // Middle — warm mixed
const RING_3 = Array.from({ length: 8 }); // Outer — soft pastels

const GOLD = ['#FFD700', '#F59E0B', '#FCD34D', '#FBBF24'];
const WARM = ['#FB7185', '#34D399', '#A78BFA', '#60A5FA', '#F97316', '#FBBF24'];
const SOFT = ['#FDE68A', '#FBCFE8', '#BBF7D0', '#BFDBFE', '#E9D5FF', '#FED7AA'];

const ICONS: (keyof typeof MaterialIcons.glyphMap)[] = [
  'star',
  'favorite',
  'auto-awesome',
  'brightness-high',
];

interface ParticleConfig {
  angle: number;
  distance: number;
  size: number;
  icon: keyof typeof MaterialIcons.glyphMap;
  color: string;
  duration: number;
  rotation: number;
}

function buildRingConfigs(
  count: number,
  distMin: number,
  distMax: number,
  durMin: number,
  durMax: number,
  sizeMin: number,
  sizeMax: number,
  palette: string[],
  icons: (keyof typeof MaterialIcons.glyphMap)[],
): ParticleConfig[] {
  return Array.from({ length: count }, (_, i) => ({
    angle: (i * 360) / count + (Math.random() * 16 - 8),
    distance: distMin + Math.random() * (distMax - distMin),
    size: sizeMin + Math.random() * (sizeMax - sizeMin),
    icon: icons[i % icons.length],
    color: palette[i % palette.length],
    duration: durMin + Math.random() * (durMax - durMin),
    rotation: (i % 2 === 0 ? 1 : -1) * (200 + Math.random() * 160),
  }));
}

export function CelebrationAnimation({
  visible,
  isDark,
}: {
  visible: boolean;
  isDark: boolean;
}) {
  // ── Animated values ──
  const mainScale = useRef(new Animated.Value(0)).current;
  const mainOpacity = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textY = useRef(new Animated.Value(24)).current;

  const r1 = useRef(RING_1.map(() => new Animated.Value(0))).current;
  const r2 = useRef(RING_2.map(() => new Animated.Value(0))).current;
  const r3 = useRef(RING_3.map(() => new Animated.Value(0))).current;

  // ── Stable configs (generated once) ──
  const cfg1 = useRef(
    buildRingConfigs(8, 50, 85, 320, 480, 10, 18, GOLD, ICONS),
  ).current;
  const cfg2 = useRef(
    buildRingConfigs(12, 90, 145, 420, 680, 12, 22, WARM, ICONS),
  ).current;
  const cfg3 = useRef(
    buildRingConfigs(
      8,
      140,
      200,
      520,
      800,
      8,
      16,
      SOFT,
      ['star', 'auto-awesome'] as (keyof typeof MaterialIcons.glyphMap)[],
    ),
  ).current;

  useEffect(() => {
    if (!visible) {
      mainScale.setValue(0);
      mainOpacity.setValue(0);
      overlayOpacity.setValue(0);
      pulseScale.setValue(1);
      textOpacity.setValue(0);
      textY.setValue(24);
      r1.forEach((p) => p.setValue(0));
      r2.forEach((p) => p.setValue(0));
      r3.forEach((p) => p.setValue(0));
      return;
    }

    // Reset before starting
    mainScale.setValue(0);
    mainOpacity.setValue(0);
    overlayOpacity.setValue(0);
    pulseScale.setValue(1);
    textOpacity.setValue(0);
    textY.setValue(24);
    r1.forEach((p) => p.setValue(0));
    r2.forEach((p) => p.setValue(0));
    r3.forEach((p) => p.setValue(0));

    const ringAnims = (
      ring: Animated.Value[],
      cfgs: ParticleConfig[],
      baseDelay: number,
    ) =>
      ring.map((p, i) =>
        Animated.sequence([
          Animated.delay(baseDelay + Math.random() * 60),
          Animated.timing(p, {
            toValue: 1,
            duration: cfgs[i].duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      );

    Animated.parallel([
      // Subtle background tint
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      // Main circle spring
      Animated.spring(mainScale, {
        toValue: 1,
        friction: 5,
        tension: 130,
        useNativeDriver: true,
      }),
      Animated.timing(mainOpacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
      // Ring bursts (staggered)
      ...ringAnims(r1, cfg1, 80),
      ...ringAnims(r2, cfg2, 180),
      ...ringAnims(r3, cfg3, 320),
      // "Bien hecho" text
      Animated.sequence([
        Animated.delay(480),
        Animated.parallel([
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 380,
            useNativeDriver: true,
          }),
          Animated.spring(textY, {
            toValue: 0,
            friction: 8,
            tension: 55,
            useNativeDriver: true,
          }),
        ]),
      ]),
      // Gentle pulse on center
      Animated.sequence([
        Animated.delay(550),
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseScale, {
              toValue: 1.1,
              duration: 700,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(pulseScale, {
              toValue: 1,
              duration: 700,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          { iterations: 2 },
        ),
      ]),
    ]).start();

    // Gentle fade-out
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(mainOpacity, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }, 2300);

    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  // ── Render helpers ──
  const renderRing = (
    ring: Animated.Value[],
    cfgs: ParticleConfig[],
    keyPrefix: string,
  ) =>
    ring.map((p, i) => {
      const c = cfgs[i];
      const rad = (c.angle * Math.PI) / 180;

      const tx = p.interpolate({
        inputRange: [0, 1],
        outputRange: [0, Math.cos(rad) * c.distance],
      });
      const ty = p.interpolate({
        inputRange: [0, 1],
        outputRange: [0, Math.sin(rad) * c.distance],
      });
      const s = p.interpolate({
        inputRange: [0, 0.25, 0.65, 1],
        outputRange: [0, 1.35, 0.95, 0],
      });
      const rot = p.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', `${c.rotation}deg`],
      });

      return (
        <Animated.View
          key={`${keyPrefix}-${i}`}
          style={[
            StyleSheet.absoluteFill,
            {
              alignItems: 'center',
              justifyContent: 'center',
              transform: [
                { translateX: tx },
                { translateY: ty },
                { scale: s },
                { rotate: rot },
              ],
            },
          ]}
        >
          <MaterialIcons
            name={c.icon as any}
            size={c.size}
            color={c.color}
          />
        </Animated.View>
      );
    });

  const combinedScale = Animated.multiply(mainScale, pulseScale);

  return (
    <Animated.View
      style={[styles.overlay, { opacity: mainOpacity }]}
      pointerEvents="none"
    >
      {/* Warm background tint */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: isDark
              ? 'rgba(0,0,0,0.35)'
              : 'rgba(255,248,230,0.55)',
            opacity: overlayOpacity,
          },
        ]}
      />

      {/* Particle rings */}
      {renderRing(r1, cfg1, 'r1')}
      {renderRing(r2, cfg2, 'r2')}
      {renderRing(r3, cfg3, 'r3')}

      {/* Glow halo */}
      <Animated.View
        style={[
          styles.glow,
          {
            backgroundColor: isDark
              ? 'rgba(218,165,32,0.12)'
              : 'rgba(255,215,0,0.18)',
            transform: [{ scale: combinedScale }],
          },
        ]}
      />

      {/* Main circle */}
      <Animated.View
        style={[
          styles.mainCircle,
          {
            backgroundColor: isDark
              ? 'rgba(218,165,32,0.28)'
              : 'rgba(255,215,0,0.22)',
            borderColor: isDark
              ? 'rgba(255,215,0,0.35)'
              : 'rgba(218,165,32,0.30)',
            shadowColor: '#FFD700',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: isDark ? 0.5 : 0.35,
            shadowRadius: 24,
            elevation: 20,
            transform: [{ scale: combinedScale }],
          },
        ]}
      >
        <MaterialIcons
          name="check"
          size={52}
          color={isDark ? '#FFD700' : '#B8860B'}
        />
      </Animated.View>

      {/* Congratulations text */}
      <Animated.View
        style={[
          styles.textWrap,
          {
            opacity: textOpacity,
            transform: [{ translateY: textY }],
          },
        ]}
      >
        <Text
          style={[
            styles.congratsText,
            { color: isDark ? '#FFD700' : '#8B6914' },
          ]}
        >
          ¡Bien hecho!
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  glow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  mainCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: {
    position: 'absolute',
    bottom: '35%',
  },
  congratsText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
});

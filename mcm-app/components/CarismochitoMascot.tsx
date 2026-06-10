import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

/* -------------------------------------------------------------------------- */
/* PNG opcional                                                               */
/* -------------------------------------------------------------------------- */
/*
 * Para usar el carismochito "de verdad" (PNG con fondo transparente):
 *   1. Sube tu imagen a  mcm-app/assets/carismochito.png
 *   2. Ajusta la línea `require(...)` de abajo (o ponla a `null` para volver
 *      al carismochito vectorial de respaldo, que también baila).
 */
const MASCOT_PNG: number | null = require('@/assets/carismochito.png');

/* -------------------------------------------------------------------------- */
/* Carismochito vectorial (respaldo)                                          */
/* -------------------------------------------------------------------------- */

const SKIN = '#4FA37A';
const SKIN_DARK = '#2E6B4F';
const OUTLINE = '#173A2A';
const CAP = '#7C7C82';
const CAP_DARK = '#5C5C62';
const MOHAWK_RED = '#E2342B';
const MOHAWK_YEL = '#F2D43B';
const IRIS = '#5B86B5';
const MOUTH = '#E2342B';

function CarismochitoFace({ size = 140 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 130 140">
      {/* Cresta (mohawk) — pinchos rojos y amarillos */}
      <Path
        d="M60 44 L40 6 L56 44 Z"
        fill={MOHAWK_RED}
        stroke={OUTLINE}
        strokeWidth={1.5}
      />
      <Path
        d="M62 44 L52 0 L70 44 Z"
        fill={MOHAWK_YEL}
        stroke={OUTLINE}
        strokeWidth={1.5}
      />
      <Path
        d="M66 44 L70 -2 L80 44 Z"
        fill={MOHAWK_RED}
        stroke={OUTLINE}
        strokeWidth={1.5}
      />
      <Path
        d="M72 46 L88 8 L82 46 Z"
        fill={MOHAWK_YEL}
        stroke={OUTLINE}
        strokeWidth={1.5}
      />

      {/* Orejas puntiagudas */}
      <Path
        d="M24 60 L6 74 L26 88 Z"
        fill={SKIN}
        stroke={OUTLINE}
        strokeWidth={2}
      />
      <Path
        d="M102 60 L122 74 L100 88 Z"
        fill={SKIN}
        stroke={OUTLINE}
        strokeWidth={2}
      />

      {/* Cabeza */}
      <Path
        d="M64 20 C34 20 22 44 22 74 C22 106 40 126 64 126 C88 126 106 106 106 74 C106 44 94 20 64 20 Z"
        fill={SKIN}
        stroke={OUTLINE}
        strokeWidth={2.5}
      />

      {/* Gorra (banda gris en la frente) */}
      <Path
        d="M26 52 Q64 30 102 52 L102 60 Q64 42 26 60 Z"
        fill={CAP}
        stroke={OUTLINE}
        strokeWidth={2}
      />
      <Path
        d="M26 56 Q64 38 102 56"
        stroke={CAP_DARK}
        strokeWidth={2}
        fill="none"
      />

      {/* Ojos grandes */}
      <Ellipse
        cx="48"
        cy="74"
        rx="14"
        ry="17"
        fill="#ffffff"
        stroke={OUTLINE}
        strokeWidth={2}
      />
      <Ellipse
        cx="80"
        cy="74"
        rx="14"
        ry="17"
        fill="#ffffff"
        stroke={OUTLINE}
        strokeWidth={2}
      />
      <Circle cx="50" cy="78" r="6.5" fill={IRIS} />
      <Circle cx="82" cy="78" r="6.5" fill={IRIS} />
      <Circle cx="50" cy="78" r="3" fill={OUTLINE} />
      <Circle cx="82" cy="78" r="3" fill={OUTLINE} />
      <Circle cx="52" cy="75" r="1.6" fill="#fff" />
      <Circle cx="84" cy="75" r="1.6" fill="#fff" />

      {/* Sonrisa + lengua */}
      <Path
        d="M46 100 Q64 116 82 100"
        stroke={OUTLINE}
        strokeWidth={3.5}
        strokeLinecap="round"
        fill="none"
      />
      <Path d="M58 107 Q64 116 70 107 Q64 113 58 107 Z" fill={MOUTH} />

      {/* Mejillas */}
      <Circle cx="34" cy="96" r="5" fill={SKIN_DARK} opacity={0.5} />
      <Circle cx="94" cy="96" r="5" fill={SKIN_DARK} opacity={0.5} />
    </Svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Mascota que baila                                                          */
/* -------------------------------------------------------------------------- */

export default function CarismochitoMascot({
  size = 140,
  /** Intensidad del baile: 1 = sutil (badge), 2 = enérgico (cuenta atrás). */
  dance = 2,
}: {
  size?: number;
  dance?: 1 | 2;
}) {
  const sway = useRef(new Animated.Value(0)).current; // rotación + balanceo lateral
  const bob = useRef(new Animated.Value(0)).current; // salto vertical + escala

  useEffect(() => {
    const swayLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, {
          toValue: 1,
          duration: dance === 2 ? 460 : 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sway, {
          toValue: -1,
          duration: dance === 2 ? 460 : 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: dance === 2 ? 300 : 700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: dance === 2 ? 300 : 700,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    swayLoop.start();
    bobLoop.start();
    return () => {
      swayLoop.stop();
      bobLoop.stop();
    };
  }, [sway, bob, dance]);

  const rotate = sway.interpolate({
    inputRange: [-1, 1],
    outputRange: dance === 2 ? ['-9deg', '9deg'] : ['-4deg', '4deg'],
  });
  const translateX = sway.interpolate({
    inputRange: [-1, 1],
    outputRange: dance === 2 ? [-6, 6] : [-2, 2],
  });
  const translateY = bob.interpolate({
    inputRange: [0, 1],
    outputRange: [0, dance === 2 ? -16 : -5],
  });
  const scale = bob.interpolate({
    inputRange: [0, 1],
    outputRange: [1, dance === 2 ? 1.08 : 1.03],
  });

  return (
    <Animated.View
      style={{
        transform: [{ translateX }, { translateY }, { rotate }, { scale }],
      }}
    >
      {MASCOT_PNG != null ? (
        <Image
          source={MASCOT_PNG}
          style={[styles.png, { width: size, height: size }]}
          contentFit="contain"
          transition={150}
        />
      ) : (
        <CarismochitoFace size={size} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  png: {
    alignSelf: 'center',
  },
});

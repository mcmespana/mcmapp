import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import {
  CarismochitoPalettes,
  type CarismochitoPalette,
  type CarismochitoPaletteId,
} from '@/constants/colors';

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

function CarismochitoFace({
  size = 140,
  palette,
}: {
  size?: number;
  palette: CarismochitoPalette;
}) {
  const {
    skin: SKIN,
    skinDark: SKIN_DARK,
    outline: OUTLINE,
    cap: CAP,
    capDark: CAP_DARK,
    mohawkA: MOHAWK_RED,
    mohawkB: MOHAWK_YEL,
    iris: IRIS,
    mouth: MOUTH,
  } = palette;
  // La silueta no lleva el blanco de los ojos ni los brillos: sin detalle.
  const eyeWhite = palette === CarismochitoPalettes.silueta ? SKIN : '#ffffff';
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
        fill={eyeWhite}
        stroke={OUTLINE}
        strokeWidth={2}
      />
      <Ellipse
        cx="80"
        cy="74"
        rx="14"
        ry="17"
        fill={eyeWhite}
        stroke={OUTLINE}
        strokeWidth={2}
      />
      <Circle cx="50" cy="78" r="6.5" fill={IRIS} />
      <Circle cx="82" cy="78" r="6.5" fill={IRIS} />
      <Circle cx="50" cy="78" r="3" fill={OUTLINE} />
      <Circle cx="82" cy="78" r="3" fill={OUTLINE} />
      <Circle cx="52" cy="75" r="1.6" fill={eyeWhite} />
      <Circle cx="84" cy="75" r="1.6" fill={eyeWhite} />

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
  /** Intensidad del baile: 0 = quieto, 1 = sutil (badge), 2 = enérgico. */
  dance = 2,
  /**
   * Paleta de una variante de la colección. Sin ella, el Carismochito de
   * siempre (el PNG). `silueta` es el de "todavía no lo has encontrado".
   */
  palette,
}: {
  size?: number;
  dance?: 0 | 1 | 2;
  palette?: CarismochitoPaletteId | null;
}) {
  const sway = useSharedValue(0); // rotación + balanceo lateral
  const bob = useSharedValue(0); // salto vertical + escala

  useEffect(() => {
    if (dance === 0) return;
    const swayMs = dance === 2 ? 460 : 900;
    const bobMs = dance === 2 ? 300 : 700;

    sway.set(
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: swayMs,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(-1, {
            duration: swayMs,
            easing: Easing.inOut(Easing.quad),
          }),
        ),
        -1,
        false,
      ),
    );
    bob.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: bobMs, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: bobMs, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );

    // Los bucles de Reanimated corren en el hilo de UI y NO se paran solos al
    // desmontar: hay que cancelarlos.
    return () => {
      cancelAnimation(sway);
      cancelAnimation(bob);
    };
  }, [sway, bob, dance]);

  const danceStyle = useAnimatedStyle(() => {
    const big = dance === 2;
    return {
      transform: [
        {
          translateX: interpolate(sway.get(), [-1, 1], big ? [-6, 6] : [-2, 2]),
        },
        { translateY: interpolate(bob.get(), [0, 1], [0, big ? -16 : -5]) },
        {
          rotate: `${interpolate(sway.get(), [-1, 1], big ? [-9, 9] : [-4, 4])}deg`,
        },
        { scale: interpolate(bob.get(), [0, 1], [1, big ? 1.08 : 1.03]) },
      ],
    };
  });

  return (
    <Animated.View style={danceStyle}>
      {palette ? (
        <CarismochitoFace size={size} palette={CarismochitoPalettes[palette]} />
      ) : MASCOT_PNG != null ? (
        <Image
          source={MASCOT_PNG}
          style={[styles.png, { width: size, height: size }]}
          contentFit="contain"
          transition={150}
        />
      ) : (
        <CarismochitoFace size={size} palette={CarismochitoPalettes.verde} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  png: {
    alignSelf: 'center',
  },
});

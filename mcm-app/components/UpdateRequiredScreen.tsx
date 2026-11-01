import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  Extrapolation,
} from 'react-native-reanimated';

import { MaterialIcons } from '@/components/ui/icons';
import AppPrimaryButton from '@/components/ui/AppPrimaryButton';
import PressableScale from '@/components/ui/PressableScale';
import brand, { themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import { durations, motionEasings, reaEasings } from '@/constants/animations';
import { useColorScheme } from '@/hooks/useColorScheme';
import { h } from '@/utils/haptics';
import { openAppStore } from '@/utils/storeLinks';

interface Props {
  /** Versión instalada, para el pie de soporte. */
  currentVersion: string;
  /** Versión mínima que exige el panel. */
  minVersion: string;
  /**
   * Veces que aún puede dejarlo pasar. `null` = sin límite. Con `0` (o sin
   * `onSkip`) la pantalla es estricta: no hay botón de «Ahora no».
   */
  skipsLeft: number | null;
  onSkip?: () => void;
}

// Tiempos del bucle de la escena (ms). Con nombre propio porque ningún token
// de `durations` es un bucle de este largo (`noLooseMotion.test.ts`).
const FLOAT_MS = 1700;
const FILL_MS = 2200;
const HOLD_MS = 1100;
const RESET_MS = 1;
const RISE_MS = 2800;
const STAGE_SIZE = 240;
const ICON_SIZE = 96;
const BAR_WIDTH = 132;
const BAR_HEIGHT = 8;
const BADGE_SIZE = 32;

/**
 * Confeti que sube: rombos de los colores del logo que se elevan y se
 * desvanecen. Es relleno decorativo (vale en claro y oscuro), no información.
 */
const PARTICLES = [
  { x: -92, size: 10, color: brand.yellow, delay: 0, rise: 150 },
  { x: -58, size: 8, color: brand.info, delay: 700, rise: 120 },
  { x: -24, size: 12, color: brand.green, delay: 1400, rise: 170 },
  { x: 14, size: 8, color: brand.accent, delay: 350, rise: 130 },
  { x: 52, size: 12, color: brand.secondary, delay: 1100, rise: 160 },
  { x: 88, size: 10, color: brand.yellow, delay: 1800, rise: 140 },
  { x: -76, size: 8, color: brand.green, delay: 2100, rise: 110 },
  { x: 74, size: 8, color: brand.info, delay: 2400, rise: 125 },
] as const;

/**
 * Pantalla de «hay que actualizar» (versión mínima del panel). El tono es el
 * de una buena noticia, no el de un castigo: la escena muestra que la
 * actualización es corta (una barra que se llena y un check) y el texto dice
 * cuánto tarda de verdad.
 *
 * Sustituye al modo `update` de `MaintenanceScreen`. Estricta o con «Ahora no»
 * según `minAppVersionSkips` (ver `VersionGateContext`).
 */
export default function UpdateRequiredScreen({
  currentVersion,
  minVersion,
  skipsLeft,
  onSkip,
}: Props) {
  const isDark = useColorScheme() === 'dark';
  const theme = themeColors(isDark);
  const canSkip = !!onSkip && (skipsLeft === null || skipsLeft > 0);

  const enter = useSharedValue(0);
  useEffect(() => {
    enter.set(
      withTiming(1, { duration: durations.slow, easing: motionEasings.out }),
    );
  }, [enter]);
  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.get(),
    transform: [{ translateY: interpolate(enter.get(), [0, 1], [12, 0]) }],
  }));

  const handleGoToStore = () => {
    h.tap();
    openAppStore();
  };
  const handleSkip = () => {
    h.tap();
    onSkip?.();
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top', 'bottom']}
    >
      <View style={styles.content}>
        <UpdateScene />

        <Animated.View style={[styles.copy, enterStyle]}>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: theme.text }]}
          >
            Hay una versión nueva
          </Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            {canSkip
              ? 'Actualizar en la tienda lleva unos 30 segundos y todo sigue como lo dejaste.'
              : 'Para seguir usando la app hace falta la versión nueva. Son unos 30 segundos en la tienda y todo sigue como lo dejaste.'}
          </Text>

          <AppPrimaryButton
            label="Actualizar en la tienda"
            icon="rocket-launch"
            color={brand.primary}
            onPress={handleGoToStore}
            style={styles.cta}
          />

          {canSkip && (
            <View style={styles.skipWrap}>
              <PressableScale
                onPress={handleSkip}
                accessibilityRole="button"
                accessibilityLabel="Seguir sin actualizar por ahora"
                style={styles.skipButton}
              >
                <Text style={[styles.skipLabel, { color: theme.link }]}>
                  Ahora no
                </Text>
              </PressableScale>
              {skipsLeft !== null && (
                <Text style={[styles.skipHint, { color: theme.textMuted }]}>
                  {skipsLeft === 1
                    ? 'Es la última vez que puedes dejarlo pasar'
                    : `Puedes dejarlo pasar ${skipsLeft} veces más`}
                </Text>
              )}
            </View>
          )}

          <Text style={[styles.version, { color: theme.textMuted }]}>
            Tienes la {currentVersion} · mínima {minVersion}
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

/**
 * La escena: el icono de la app flota con una flecha hacia arriba, debajo se
 * llena una barra y, al llegar al final, la flecha se vuelve un check. Y vuelta
 * a empezar. Con «reducir movimiento» se queda el fotograma final, quieto.
 */
function UpdateScene() {
  const isDark = useColorScheme() === 'dark';
  const theme = themeColors(isDark);
  const reduced = useReducedMotion();

  const float = useSharedValue(0);
  const fill = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      fill.set(1);
      return;
    }
    float.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: FLOAT_MS, easing: motionEasings.inOut }),
          withTiming(0, { duration: FLOAT_MS, easing: motionEasings.inOut }),
        ),
        -1,
        false,
      ),
    );
    fill.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: FILL_MS, easing: motionEasings.inOut }),
          withDelay(
            HOLD_MS,
            withTiming(0, { duration: RESET_MS, easing: reaEasings.standard }),
          ),
        ),
        -1,
        false,
      ),
    );
    return () => {
      cancelAnimation(float);
      cancelAnimation(fill);
    };
  }, [reduced, float, fill]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(float.get(), [0, 1], [0, -8]) }],
  }));
  const barFillStyle = useAnimatedStyle(() => ({
    width: interpolate(fill.get(), [0, 1], [0, BAR_WIDTH]),
  }));
  // Flecha → check cuando la barra llega al final.
  const arrowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fill.get(), [0.85, 0.95], [1, 0], Extrapolation.CLAMP),
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fill.get(), [0.85, 0.95], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(
          fill.get(),
          [0.85, 0.95, 1],
          [0.4, 1.15, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <View
      style={styles.stage}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {!reduced && PARTICLES.map((p, i) => <Confetti key={i} {...p} />)}

      <Animated.View style={[styles.iconWrap, iconStyle]}>
        <Image
          source={require('@/assets/images/icon.png')}
          style={styles.icon}
        />
        <View style={styles.badge}>
          <Animated.View style={[styles.badgeGlyph, arrowStyle]}>
            <MaterialIcons name="arrow-upward" size={20} color="#fff" />
          </Animated.View>
          <Animated.View style={[styles.badgeGlyph, checkStyle]}>
            <MaterialIcons name="check" size={20} color="#fff" />
          </Animated.View>
        </View>
      </Animated.View>

      <View style={[styles.barTrack, { backgroundColor: theme.separator }]}>
        <Animated.View style={[styles.barFill, barFillStyle]} />
      </View>
    </View>
  );
}

function Confetti({
  x,
  size,
  color,
  delay,
  rise,
}: {
  x: number;
  size: number;
  color: string;
  delay: number;
  rise: number;
}) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.set(
      withDelay(
        delay,
        withRepeat(
          withTiming(1, { duration: RISE_MS, easing: motionEasings.out }),
          -1,
          false,
        ),
      ),
    );
    return () => cancelAnimation(t);
  }, [t, delay]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.get(), [0, 0.15, 0.7, 1], [0, 1, 0.9, 0]),
    transform: [
      { translateY: interpolate(t.get(), [0, 1], [0, -rise]) },
      { rotate: '45deg' },
      { scale: interpolate(t.get(), [0, 0.2, 1], [0.4, 1, 0.7]) },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.confetti,
        { left: STAGE_SIZE / 2 + x, width: size, height: size },
        { backgroundColor: color },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  stage: {
    width: STAGE_SIZE,
    height: STAGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    marginBottom: spacing.lg,
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: radii.xl,
    ...shadows.raised,
  },
  badge: {
    position: 'absolute',
    right: -spacing.sm,
    bottom: -spacing.sm,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: radii.pillFull,
    backgroundColor: brand.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGlyph: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  barTrack: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: radii.pillFull,
    overflow: 'hidden',
  },
  barFill: {
    height: BAR_HEIGHT,
    borderRadius: radii.pillFull,
    backgroundColor: brand.info,
  },
  confetti: {
    position: 'absolute',
    bottom: STAGE_SIZE / 2,
    borderRadius: radii.xs,
  },
  copy: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
    gap: spacing.md,
  },
  title: {
    ...typography.h1,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    textAlign: 'center',
    lineHeight: 23,
  },
  cta: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
  },
  skipWrap: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  skipButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipLabel: {
    ...typography.button,
  },
  skipHint: {
    ...typography.caption,
    textAlign: 'center',
  },
  version: {
    ...typography.footnote,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});

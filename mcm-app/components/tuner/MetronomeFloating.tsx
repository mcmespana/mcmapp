/**
 * El metrónomo sonando con la hoja cerrada: una píldora abajo a la izquierda
 * (la derecha es del botón de la canción) con el tempo, un punto que late con
 * el pulso y un botón de parar. Tocarla vuelve a abrir el metrónomo. Solo en
 * las pantallas del cantoral (la monta su layout); no sale con la hoja del
 * metrónomo abierta ni mientras se pregunta si dejarlo sonando.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@/components/ui/icons';
import { themeColors } from '@/constants/colors';
import { durations, motionEasings } from '@/constants/animations';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import { useMetronome } from '@/contexts/MetronomeContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { openCantoral } from '@/utils/cantoralNavigation';
import { h } from '@/utils/haptics';

/** Área táctil mínima (design.md §1). */
const TOUCH = 48;
const DOT = 10;
/** Lo que tarda el punto en hincharse con el pulso: casi un golpe. */
const BEAT_ATTACK_MS = 40;

export default function MetronomeFloating() {
  const m = useMetronome();
  const isDark = useColorScheme() === 'dark';
  const theme = themeColors(isDark);
  const bottom = useTabBarClearance(spacing.sm);
  const reducedMotion = useReducedMotion();

  // El punto late con cada pulso, en el hilo de UI.
  const scale = useSharedValue(1);
  useAnimatedReaction(
    () => m.pulse.get(),
    (now, before) => {
      if (before === null || now === before || reducedMotion) return;
      scale.set(
        withSequence(
          withTiming(1.6, {
            duration: BEAT_ATTACK_MS,
            easing: motionEasings.out,
          }),
          withTiming(1, {
            duration: durations.base,
            easing: motionEasings.out,
          }),
        ),
      );
    },
  );
  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  if (!m.playing || m.panelOpen || m.asking) return null;

  const accent = theme.link;
  return (
    <Animated.View
      entering={FadeIn.duration(durations.base)}
      exiting={FadeOut.duration(durations.quick)}
      style={[
        styles.pill,
        shadows.raised,
        { bottom, backgroundColor: theme.card, borderColor: theme.separator },
      ]}
      pointerEvents="box-none"
    >
      <PressableFeedback
        onPress={() => {
          h.tap();
          openCantoral('Tuner', { modo: 'metronomo' });
        }}
        style={styles.main}
        accessibilityRole="button"
        accessibilityLabel={`Metrónomo sonando a ${m.bpm} pulsos por minuto. Abrir`}
      >
        <Animated.View
          style={[styles.dot, { backgroundColor: accent }, dotStyle]}
        />
        <MaterialIcons name="timer" size={18} color={accent} />
        <Text
          style={[styles.bpm, { color: theme.text }]}
          maxFontSizeMultiplier={1.3}
        >
          {m.bpm}
        </Text>
      </PressableFeedback>
      <View style={[styles.divider, { backgroundColor: theme.separator }]} />
      <PressableFeedback
        onPress={() => {
          h.toggle();
          m.stop();
        }}
        style={styles.stop}
        accessibilityRole="button"
        accessibilityLabel="Parar el metrónomo"
      >
        <MaterialIcons name="stop" size={24} color={theme.text} />
      </PressableFeedback>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.pillFull,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  main: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: TOUCH,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
  },
  dot: { width: DOT, height: DOT, borderRadius: radii.pillFull },
  bpm: {
    ...typography.title,
    fontVariant: ['tabular-nums'],
  },
  divider: { width: StyleSheet.hairlineWidth, height: TOUCH / 2 },
  stop: {
    width: TOUCH,
    height: TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

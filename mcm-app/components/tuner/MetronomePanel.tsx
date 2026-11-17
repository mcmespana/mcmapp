/**
 * El metrónomo, al lado del afinador en la misma hoja. Poco y grande: el
 * tempo, los pulsos del compás y un botón. La lógica está en
 * `hooks/useMetronome.ts` y `utils/metronome.ts`; el sonido, en
 * `services/metronome/engine.ts`.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { PressableFeedback } from 'heroui-native';
import PressableScale from '@/components/ui/PressableScale';
import { MaterialIcons } from '@/components/ui/icons';
import { KeyPillColors, themeColors } from '@/constants/colors';
import { durations, motionEasings } from '@/constants/animations';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useKeepAwakeWhileFocused } from '@/hooks/useKeepAwakeWhileFocused';
import { useMetronome } from '@/hooks/useMetronome';
import { useRepeatPress } from '@/hooks/useRepeatPress';
import { onColor } from '@/utils/colorUtils';
import { h } from '@/utils/haptics';
import { BEATS_OPTIONS, MAX_BPM, MIN_BPM } from '@/utils/metronome';

const STEP = 44;
const PLAY = 76;
const DOT = 14;
const DOT_ACCENT = 20;
/** Lo que tarda el número en hincharse con el pulso: casi un golpe. */
const BEAT_ATTACK_MS = 40;

export default function MetronomePanel() {
  const isDark = useColorScheme() === 'dark';
  const theme = themeColors(isDark);
  const reducedMotion = useReducedMotion();
  const m = useMetronome();
  useKeepAwakeWhileFocused('metronome');

  // El número late con cada pulso, en el hilo de UI.
  const beatScale = useSharedValue(1);
  useAnimatedReaction(
    () => m.pulse.get(),
    (now, before) => {
      if (before === null || now === before || reducedMotion) return;
      beatScale.set(
        withSequence(
          withTiming(1.04, {
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
  const numberStyle = useAnimatedStyle(() => ({
    transform: [{ scale: beatScale.get() }],
  }));

  const step = (delta: number) => () => {
    const next = m.bpm + delta;
    if (next < MIN_BPM || next > MAX_BPM) {
      h.limit();
      return false;
    }
    h.select();
    m.setBpm(next);
    return true;
  };
  const less = useRepeatPress(step(-1), { intervalMs: 60 });
  const more = useRepeatPress(step(1), { intervalMs: 60 });

  const accent = theme.link;
  const surface = theme.backgroundSunken;
  const dots = Array.from({ length: m.beatsPerBar }, (_, i) => i);

  return (
    <View style={styles.root}>
      {/* Los pulsos del compás: el primero, más grande. */}
      <View
        style={styles.dots}
        accessible
        accessibilityRole="text"
        accessibilityLabel={`Compás de ${m.beatsPerBar}`}
      >
        {dots.map((i) => {
          const first = i === 0 && m.beatsPerBar > 1;
          const size = first ? DOT_ACCENT : DOT;
          const on = m.playing && m.beat === i;
          return (
            <View key={i} style={styles.dotSlot}>
              <View
                style={{
                  width: size,
                  height: size,
                  borderRadius: radii.pillFull,
                  backgroundColor: on ? accent : theme.separator,
                }}
              />
            </View>
          );
        })}
      </View>

      <View style={styles.tempoRow}>
        <PressableFeedback
          {...less}
          style={[styles.step, { backgroundColor: surface }]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Más lento"
        >
          <MaterialIcons name="remove" size={24} color={theme.text} />
        </PressableFeedback>

        <View
          style={styles.tempo}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Tempo"
          accessibilityValue={{ text: `${m.bpm} pulsos por minuto` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'increment') step(1)();
            if (e.nativeEvent.actionName === 'decrement') step(-1)();
          }}
        >
          <Animated.Text
            style={[styles.bpm, { color: theme.text }, numberStyle]}
            maxFontSizeMultiplier={1.3}
            numberOfLines={1}
          >
            {m.bpm}
          </Animated.Text>
          <Text
            style={[styles.unit, { color: theme.textMuted }]}
            maxFontSizeMultiplier={1.3}
          >
            pulsos por minuto
          </Text>
        </View>

        <PressableFeedback
          {...more}
          style={[styles.step, { backgroundColor: surface }]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Más rápido"
        >
          <MaterialIcons name="add" size={24} color={theme.text} />
        </PressableFeedback>
      </View>

      <View
        style={styles.beats}
        accessibilityRole="radiogroup"
        accessibilityLabel="Pulsos por compás"
      >
        {BEATS_OPTIONS.map((n) => {
          const selected = n === m.beatsPerBar;
          return (
            <PressableFeedback
              key={n}
              onPress={() => {
                h.select();
                m.setBeatsPerBar(n);
              }}
              style={[
                styles.beatChip,
                {
                  backgroundColor: selected
                    ? isDark
                      ? KeyPillColors.bgDark
                      : KeyPillColors.bgLight
                    : surface,
                  borderColor: selected ? accent : 'transparent',
                },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={
                n === 1 ? 'Sin acento' : `${n} pulsos por compás`
              }
            >
              <Text
                style={[
                  styles.beatChipText,
                  { color: selected ? accent : theme.textSecondary },
                ]}
                maxFontSizeMultiplier={1.3}
              >
                {n}
              </Text>
            </PressableFeedback>
          );
        })}
      </View>

      <PressableScale
        onPress={() => {
          h.toggle();
          m.toggle();
        }}
        style={[styles.play, shadows.raised, { backgroundColor: accent }]}
        accessibilityRole="button"
        accessibilityLabel={
          m.playing ? 'Parar el metrónomo' : 'Empezar el metrónomo'
        }
      >
        <MaterialIcons
          name={m.playing ? 'stop' : 'play-arrow'}
          size={40}
          color={onColor(accent)}
        />
      </PressableScale>

      <PressableFeedback
        onPress={() => {
          h.tap();
          m.tap();
        }}
        style={styles.tap}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Marcar el tempo"
        accessibilityHint="Toca varias veces al ritmo que quieras"
      >
        <MaterialIcons name="touch-app" size={18} color={accent} />
        <Text style={[styles.tapText, { color: accent }]}>Marcar el tempo</Text>
      </PressableFeedback>

      {m.failed && (
        <Text style={[styles.failed, { color: theme.textSecondary }]}>
          Este dispositivo no deja reproducir el sonido.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: spacing.lg,
    width: '100%',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    height: DOT_ACCENT,
  },
  dotSlot: {
    width: DOT_ACCENT,
    height: DOT_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tempoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  step: {
    width: STEP,
    height: STEP,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tempo: {
    alignItems: 'center',
    minWidth: 190,
  },
  bpm: {
    ...typography.display,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  unit: {
    ...typography.caption,
  },
  beats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  beatChip: {
    width: STEP + spacing.xs,
    height: STEP,
    borderRadius: radii.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beatChipText: {
    ...typography.title,
    fontVariant: ['tabular-nums'],
  },
  play: {
    width: PLAY,
    height: PLAY,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  tapText: {
    ...typography.button,
  },
  failed: {
    ...typography.caption,
    textAlign: 'center',
  },
});

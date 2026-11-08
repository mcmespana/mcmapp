/**
 * La canción de al lado, asomando por el borde mientras se arrastra la letra
 * (skill `gestures`: valores ENLAZADOS al arrastre).
 *
 * No tiene animación propia: su opacidad, su posición y su «armado» salen del
 * mismo `slide` que mueve la letra. Así está siempre exactamente tan visible
 * como lo arrastrado — también a mitad de gesto y si el usuario se arrepiente
 * y vuelve. Cuando el arrastre pasa el umbral (soltar ya cambia de canción),
 * la pastilla se «arma»: crece un poco y la flecha toma el color de acción.
 *
 * Además es lo que hace DESCUBRIBLE el gesto: la pista de las primeras veces
 * (`useGestureHint` en SongDetailScreen) aparta la letra un poco y aparece
 * esto diciendo a qué canción se iría.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { MaterialIcons } from '@/components/ui/icons';
import { springs } from '@/constants/animations';
import { themeColors } from '@/constants/colors';
import { radii, shadows } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';

/** Arrastre (px) desde el que la pastilla empieza a verse / se ve entera. */
const FADE_FROM = 12;
const FADE_TO = 64;
/** De dónde entra la pastilla (px hacia fuera del borde). */
const ENTER_OFFSET = 36;
const ARMED_SCALE = 1.06;

interface SongSwipePeekProps {
  side: 'prev' | 'next';
  /** Título de la canción a la que se iría. */
  title: string;
  /** El desplazamiento de la letra (px, negativo = hacia la izquierda). */
  slide: SharedValue<number>;
  /** 0 = oculta pase lo que pase (durante el cambio de canción ya hecho). */
  enabled: SharedValue<number>;
  /** Arrastre a partir del cual soltar cambia de canción. */
  armAt: number;
  /** Visibilidad forzada (0–1) para la pista con «reducir movimiento». */
  reveal?: SharedValue<number>;
  isDark: boolean;
}

export default function SongSwipePeek({
  side,
  title,
  slide,
  enabled,
  armAt,
  reveal,
  isDark,
}: SongSwipePeekProps) {
  const sign = side === 'next' ? -1 : 1;
  const palette = themeColors(isDark);

  // Lo arrastrado HACIA este lado (0 si se arrastra hacia el otro).
  const pulled = useDerivedValue(() => Math.max(0, slide.get() * sign));
  // «Armada» = soltar ya cambia de canción. Salta con un muelle al cruzar.
  const armed = useSharedValue(0);
  useAnimatedReaction(
    () => pulled.get() >= armAt,
    (isArmed, prev) => {
      if (isArmed === prev) return;
      armed.set(withSpring(isArmed ? 1 : 0, springs.snap));
    },
    [armAt],
  );

  const pillStyle = useAnimatedStyle(() => {
    const drag = interpolate(
      pulled.get(),
      [FADE_FROM, FADE_TO],
      [0, 1],
      'clamp',
    );
    const shown = Math.max(drag, reveal ? reveal.get() : 0) * enabled.get();
    const fromEdge = side === 'next' ? ENTER_OFFSET : -ENTER_OFFSET;
    return {
      opacity: shown,
      transform: [
        { translateX: interpolate(shown, [0, 1], [fromEdge, 0]) },
        { scale: interpolate(armed.get(), [0, 1], [1, ARMED_SCALE]) },
      ],
    };
  });

  const armedIconStyle = useAnimatedStyle(() => ({ opacity: armed.get() }));

  const chevron = side === 'next' ? 'chevron-left' : 'chevron-right';

  return (
    <Animated.View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        styles.pill,
        side === 'next' ? styles.right : styles.left,
        { backgroundColor: palette.card },
        pillStyle,
      ]}
    >
      {side === 'next' && (
        <Chevron
          name={chevron}
          idle={palette.textMuted}
          active={palette.link}
          armedStyle={armedIconStyle}
        />
      )}
      <View style={styles.texts}>
        <Text style={[styles.label, { color: palette.textSecondary }]}>
          {side === 'next' ? 'Siguiente' : 'Anterior'}
        </Text>
        <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {side === 'prev' && (
        <Chevron
          name={chevron}
          idle={palette.textMuted}
          active={palette.link}
          armedStyle={armedIconStyle}
        />
      )}
    </Animated.View>
  );
}

/** Flecha que cambia al color de acción al armarse (cruce de opacidades). */
function Chevron({
  name,
  idle,
  active,
  armedStyle,
}: {
  name: 'chevron-left' | 'chevron-right';
  idle: string;
  active: string;
  armedStyle: ReturnType<typeof useAnimatedStyle>;
}) {
  return (
    <View style={styles.chevron}>
      <MaterialIcons name={name} size={22} color={idle} />
      <Animated.View style={[StyleSheet.absoluteFill, armedStyle]}>
        <MaterialIcons name={name} size={22} color={active} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    top: '46%',
    maxWidth: 210,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radii.pillFull,
    zIndex: 20,
    ...shadows.raised,
  },
  right: { right: spacing.md },
  left: { left: spacing.md },
  texts: { flexShrink: 1 },
  label: {
    ...typography.footnote,
    fontWeight: '600',
  },
  title: {
    ...typography.subhead,
    fontWeight: '700',
  },
  chevron: { width: 22, height: 22 },
});

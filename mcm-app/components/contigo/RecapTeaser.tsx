/**
 * La entrada a «Tu año en Contigo». Dos formas:
 *
 * - Fuera de temporada: una línea discreta al final de Contigo.
 * - En temporada (Adviento y comienzo de año, `utils/contigoRecapSeason.ts`):
 *   una tarjeta dorada arriba, con un brillo que la recorre y la estrella que
 *   respira. Tras tres visitas se queda quieta.
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { warm } from '@/components/contigo/theme';
import { MaterialIcons } from '@/components/ui/icons';
import { durations } from '@/constants/animations';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import { onColor } from '@/utils/colorUtils';

/** Un brillo cada ~4 s; la estrella respira a la vez. */
const SHINE_MS = 1400;
const SHINE_PAUSE_MS = 2600;
const SHINE_W = 120;
/** Vuelta del brillo a la izquierda, sin que se vea. */
const SHINE_RESET_MS = 0;

export function RecapLink({
  isDark,
  onPress,
}: {
  isDark: boolean;
  onPress: () => void;
}) {
  const W = warm(isDark);
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.link}
      accessibilityRole="button"
      accessibilityLabel="Tu año en Contigo"
    >
      <MaterialIcons name="auto-awesome" size={14} color={W.textSec} />
      <Text style={[styles.linkText, { color: W.textSec }]}>
        Tu año en Contigo
      </Text>
    </TouchableOpacity>
  );
}

export function RecapFeatured({
  year,
  animate,
  isDark,
  onPress,
}: {
  year: number;
  animate: boolean;
  isDark: boolean;
  onPress: () => void;
}) {
  const W = warm(isDark);
  const reduced = useReducedMotion();
  const live = animate && !reduced;
  const shine = useSharedValue(0);
  const star = useSharedValue(1);
  const [width, setWidth] = React.useState(0);

  useEffect(() => {
    if (!live) {
      cancelAnimation(shine);
      cancelAnimation(star);
      shine.set(0);
      star.set(1);
      return;
    }
    shine.set(
      withRepeat(
        withSequence(
          withTiming(0, { duration: SHINE_RESET_MS }),
          withDelay(
            SHINE_PAUSE_MS,
            withTiming(1, {
              duration: SHINE_MS,
              easing: Easing.inOut(Easing.quad),
            }),
          ),
        ),
        -1,
      ),
    );
    star.set(
      withRepeat(
        withSequence(
          withTiming(1.18, { duration: durations.hero }),
          withTiming(1, { duration: durations.hero }),
        ),
        -1,
      ),
    );
  }, [live, shine, star]);

  const shineStyle = useAnimatedStyle(() => ({
    opacity: shine.get() > 0 && shine.get() < 1 ? 1 : 0,
    transform: [
      { translateX: -SHINE_W + shine.get() * (width + SHINE_W * 2) },
      { rotate: '18deg' },
    ],
  }));
  const starStyle = useAnimatedStyle(() => ({
    transform: [{ scale: star.get() }],
  }));

  const ink = onColor(W.accent);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.card, shadows.warm]}
      accessibilityRole="button"
      accessibilityLabel={`Tu ${year} en Contigo`}
      accessibilityHint="Lo que has rezado, leído y subrayado este año"
    >
      <LinearGradient
        colors={W.recapGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={StyleSheet.absoluteFill}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        pointerEvents="none"
      >
        <Animated.View style={[styles.shine, shineStyle]}>
          <LinearGradient
            colors={[
              'rgba(255,255,255,0)',
              'rgba(255,255,255,0.45)',
              'rgba(255,255,255,0)',
            ]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
      <Animated.View style={[styles.starWrap, starStyle]}>
        <MaterialIcons name="auto-awesome" size={28} color={ink} />
      </Animated.View>
      <View style={styles.cardText}>
        <Text style={[styles.kicker, { color: ink }]}>Ya está aquí</Text>
        <Text style={[styles.title, { color: ink }]}>Tu {year} en Contigo</Text>
      </View>
      <MaterialIcons name="chevron-right" size={24} color={ink} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 44,
    marginTop: spacing.md,
  },
  linkText: { ...typography.caption, fontWeight: '600' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 76,
    paddingHorizontal: spacing.md + spacing.xs,
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  shine: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: SHINE_W,
  },
  starWrap: { width: 32, alignItems: 'center' },
  cardText: { flex: 1 },
  kicker: { ...typography.sectionLabel, opacity: 0.85 },
  title: {
    ...typography.h3,
    fontFamily: typography.serif.fontFamily,
    marginTop: 2,
  },
});

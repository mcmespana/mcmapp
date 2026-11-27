/**
 * El escenario de Compartiendo: la tarjeta grande de arriba del muro, en el
 * color del evento (el mismo degradado que el héroe del hub, para que se note
 * que es la misma casa). Enseña que el muro está vivo:
 *
 *   · una pastilla con el pulso del muro («Ahora mismo», «Última hace 2 h»),
 *   · las últimas reflexiones pasando solas, una a una, con fundido,
 *   · quién ha escrito (pila de avatares) y cuántas hay,
 *   · y la acción principal: verlas como historias (o escribir la primera).
 *
 * El movimiento (pulso y rotación) solo corre con la pantalla enfocada y se
 * apaga con «reducir movimiento».
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { MaterialIcons } from '@/components/ui/icons';
import PressableScale from '@/components/ui/PressableScale';
import { AvatarStack } from '@/components/reflexiones/Avatars';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import { durations, motionEasings } from '@/constants/animations';
import { darkenHex, hexAlpha, onColor } from '@/utils/colorUtils';
import { eventHeroColors } from '@/utils/tintInk';
import { clipText } from '@/utils/shareCard';
import {
  countLabel,
  relativeTime,
  splitAuthor,
  type WallStats,
} from '@/utils/reflexiones';

/** Cada cuánto pasa a la siguiente reflexión. */
const ROTATE_MS = 6500;
/** Menos de esto desde la última, y el muro está «ahora mismo». */
const LIVE_WINDOW_MS = 20 * 60_000;
/** Hasta aquí, la cita del escenario va con la letra grande. */
const BIG_QUOTE_CHARS = 90;

export interface StageQuote {
  id: string;
  text: string;
  author: string;
}

interface Props {
  tint: string;
  stats: WallStats;
  quotes: StageQuote[];
  now: number;
  /** Pantalla enfocada: si no, nada se mueve. */
  active: boolean;
  /** Color del avatar de cada firma. */
  colorFor: (name: string, index: number) => string;
  onPlay: () => void;
  onWrite: () => void;
}

export default function ReflexionesStage({
  tint,
  stats,
  quotes,
  now,
  active,
  colorFor,
  onPlay,
  onWrite,
}: Props) {
  const { fg, muted, emblemBg } = eventHeroColors(tint);
  const reduced = useReducedMotion();
  const empty = stats.total === 0;
  const live = stats.lastAt !== null && now - stats.lastAt < LIVE_WINDOW_MS;

  // ── La cita que pasa ──
  const [index, setIndex] = useState(0);
  const fade = useSharedValue(1);
  const rotating = active && !reduced && quotes.length > 1;
  useEffect(() => {
    if (!rotating) return;
    let swap: ReturnType<typeof setTimeout> | undefined;
    const tick = setInterval(() => {
      fade.set(withTiming(0, { duration: durations.base }));
      swap = setTimeout(() => {
        setIndex((i) => i + 1);
        fade.set(
          withTiming(1, {
            duration: durations.slow,
            easing: motionEasings.out,
          }),
        );
      }, durations.base);
    }, ROTATE_MS);
    return () => {
      clearInterval(tick);
      if (swap) clearTimeout(swap);
      fade.set(1);
    };
  }, [rotating, fade]);
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fade.get(),
    transform: [{ translateY: (1 - fade.get()) * 6 }],
  }));
  const quote = quotes.length ? quotes[index % quotes.length] : null;

  // ── El pulso ──
  const pulse = useSharedValue(1);
  const pulsing = live && active && !reduced;
  useEffect(() => {
    if (!pulsing) {
      cancelAnimation(pulse);
      pulse.set(1);
      return;
    }
    pulse.set(
      withRepeat(
        withSequence(
          withTiming(0.3, { duration: durations.hero }),
          withTiming(1, { duration: durations.hero }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(pulse);
  }, [pulsing, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.get() }));

  const ago = relativeTime(stats.lastAt, now);
  const pill = empty
    ? 'Muro en blanco'
    : live
      ? 'Ahora mismo'
      : ago
        ? `Última ${ago}`
        : countLabel(stats.total, 'reflexión', 'reflexiones');

  const ctaInk = onColor(fg);
  const quoteText = quote ? clipText(quote.text, 170) : '';
  const quoteName = quote ? splitAuthor(quote.author).name : '';

  return (
    <LinearGradient
      colors={[tint, darkenHex(tint, 0.24)]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.stage}
    >
      <View style={styles.topRow}>
        <View style={[styles.pill, { backgroundColor: emblemBg }]}>
          <Animated.View
            style={[
              styles.dot,
              { backgroundColor: live ? fg : hexAlpha(fg, '8C') },
              pulseStyle,
            ]}
          />
          <Text style={[styles.pillText, { color: fg }]}>{pill}</Text>
        </View>
        {!empty ? (
          <Text style={[styles.count, { color: muted }]} numberOfLines={1}>
            {countLabel(stats.total, 'reflexión', 'reflexiones')}
          </Text>
        ) : null}
      </View>

      {quote ? (
        <Animated.View
          style={[styles.quoteBox, fadeStyle]}
          accessibilityLiveRegion="none"
        >
          <Text
            style={[
              quoteText.length <= BIG_QUOTE_CHARS
                ? styles.quoteBig
                : styles.quote,
              { color: fg },
            ]}
            numberOfLines={5}
            maxFontSizeMultiplier={1.5}
          >
            “{quoteText}”
          </Text>
          <Text style={[styles.by, { color: muted }]} numberOfLines={1}>
            {quoteName ? `— ${quoteName}` : '— Anónimo'}
          </Text>
        </Animated.View>
      ) : (
        <View style={styles.quoteBox}>
          <Text style={[styles.quoteBig, { color: fg }]}>Estrena el muro</Text>
          <Text style={[styles.lead, { color: muted }]}>
            Lo primero que compartas lo verá todo el encuentro.
          </Text>
        </View>
      )}

      <View style={styles.foot}>
        <View style={styles.people}>
          <AvatarStack
            names={stats.recentAuthors}
            colorFor={colorFor}
            // Tres caras y la cifra al lado: con cuatro y el «+N» no cabía
            // «7 personas» junto al botón en un móvil normal.
            max={3}
            total={Math.min(3, stats.recentAuthors.length)}
            ring={darkenHex(tint, 0.12)}
            moreColor={emblemBg}
            moreInk={fg}
            size={30}
          />
          {stats.people > 0 ? (
            <Text style={[styles.count, { color: muted }]} numberOfLines={1}>
              {countLabel(stats.people, 'persona', 'personas')}
            </Text>
          ) : null}
        </View>
        <PressableScale
          onPress={empty ? onWrite : onPlay}
          style={[styles.cta, { backgroundColor: fg }]}
          accessibilityRole="button"
          accessibilityLabel={
            empty ? 'Escribir la primera' : 'Ver las reflexiones como historias'
          }
        >
          <MaterialIcons
            name={empty ? 'edit' : 'play-arrow'}
            size={20}
            color={ctaInk}
          />
          <Text style={[styles.ctaText, { color: ctaInk }]}>
            {empty ? 'Escribir' : 'Historias'}
          </Text>
        </PressableScale>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  stage: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    paddingTop: spacing.md + spacing.xs,
    overflow: 'hidden',
    gap: spacing.md,
    ...(shadows.hero as object),
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
    borderRadius: radii.full,
  },
  dot: { width: 8, height: 8, borderRadius: radii.pillFull },
  pillText: { ...typography.footnote, fontWeight: '700' },
  quoteBox: { gap: spacing.sm, minHeight: 96, justifyContent: 'center' },
  quoteBig: {
    ...typography.h2,
    lineHeight: 29,
    letterSpacing: -0.4,
  },
  quote: {
    ...typography.h3,
    lineHeight: 25,
    letterSpacing: -0.2,
  },
  by: { ...typography.subhead, fontWeight: '600' },
  lead: { ...typography.subhead, lineHeight: 20 },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  people: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  count: { ...typography.footnote, fontWeight: '600', lineHeight: 16 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingLeft: spacing.sm + 4,
    paddingRight: spacing.md,
    borderRadius: radii.full,
  },
  ctaText: { ...typography.button, fontWeight: '700' },
});

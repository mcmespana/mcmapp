/**
 * Una reflexión en el muro de Compartiendo. Dos formas, que salen solas del
 * texto (`reflexionShape`):
 *
 *   · **Cartel** — una frase corta: el color de su tono de fondo y la letra
 *     grande. Es lo que da ritmo y color al muro.
 *   · **Nota** — un texto largo o con título: superficie neutra y letra de
 *     lectura; el tono queda en el avatar y en las comillas.
 *
 * Tocar abre la reflexión a pantalla completa (modo historias); mantener
 * pulsado (o clic derecho en web), copiar y compartir.
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { MaterialIcons } from '@/components/ui/icons';
import PressableScale from '@/components/ui/PressableScale';
import { AuthorAvatar } from '@/components/reflexiones/Avatars';
import { useContextMenu } from '@/hooks/useContextMenu';
import { themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import { durations, motionEasings } from '@/constants/animations';
import { hexAlpha, onColor, readableOn } from '@/utils/colorUtils';
import {
  NOTE_CLAMP_CHARS,
  POSTER_XL_MAX_CHARS,
  reflexionShape,
  splitAuthor,
  toneColor,
  type Reflexion,
  type ReflexionTone,
} from '@/utils/reflexiones';

/** Cuánto sube la tarjeta que acaba de llegar mientras aparece. */
const ARRIVAL_RISE = 14;

interface Props {
  r: Reflexion;
  /** Firma ya resuelta (grupo o autor). */
  author: string;
  tone: ReflexionTone;
  isDark: boolean;
  /** «hace 5 min», o vacío. */
  timeLabel?: string | null;
  /** Recién llegada: aparece con un fundido corto (solo ella, no la lista). */
  isNew?: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

function ReflexionCard({
  r,
  author,
  tone,
  isDark,
  timeLabel,
  isNew = false,
  onPress,
  onLongPress,
}: Props) {
  const roles = themeColors(isDark);
  const fill = toneColor(tone);
  const shape = reflexionShape(r);
  const { name, detail } = splitAuthor(author);
  const ctx = useContextMenu(onLongPress);

  const reduced = useReducedMotion();
  const appear = useSharedValue(isNew && !reduced ? 0 : 1);
  useEffect(() => {
    if (appear.get() < 1) {
      appear.set(
        withTiming(1, { duration: durations.slow, easing: motionEasings.out }),
      );
    }
  }, [appear]);
  const arrival = useAnimatedStyle(() => ({
    opacity: appear.get(),
    transform: [{ translateY: (1 - appear.get()) * ARRIVAL_RISE }],
  }));

  const a11yLabel = `${name || 'Anónimo'}${detail ? `, ${detail}` : ''}: ${
    r.titulo ? `${r.titulo}. ` : ''
  }${r.contenido}`;
  const meta = [detail, timeLabel].filter(Boolean).join(' · ');

  if (shape === 'poster') {
    const ink = onColor(fill);
    const xl = r.contenido.trim().length <= POSTER_XL_MAX_CHARS;
    return (
      <Animated.View style={arrival}>
        <PressableScale
          onPress={onPress}
          {...ctx}
          style={[
            styles.poster,
            { backgroundColor: fill },
            { ...(shadows.raised as ViewStyle), shadowColor: fill },
          ]}
          accessibilityRole="button"
          accessibilityLabel={a11yLabel}
          accessibilityHint="Ábrela a pantalla completa"
        >
          <MaterialIcons
            name="format-quote"
            size={44}
            color={hexAlpha(ink, '59')}
            style={styles.posterQuote}
          />
          <Text
            style={[xl ? styles.posterXl : styles.posterLg, { color: ink }]}
            maxFontSizeMultiplier={1.6}
          >
            {r.contenido.trim()}
          </Text>
          <View style={styles.posterFoot}>
            <AuthorAvatar
              name={author}
              color={hexAlpha(ink, '26')}
              ink={ink}
              size={30}
            />
            <View style={styles.flex}>
              <Text
                style={[styles.posterName, { color: ink }]}
                numberOfLines={1}
              >
                {name || 'Anónimo'}
              </Text>
              {meta ? (
                <Text
                  style={[styles.posterMeta, { color: hexAlpha(ink, 'C7') }]}
                  numberOfLines={1}
                >
                  {meta}
                </Text>
              ) : null}
            </View>
          </View>
        </PressableScale>
      </Animated.View>
    );
  }

  const surface = roles.background;
  const toneInk = readableOn(fill, surface, 3);
  const long = r.contenido.length > NOTE_CLAMP_CHARS;
  return (
    <Animated.View style={arrival}>
      <PressableScale
        onPress={onPress}
        {...ctx}
        style={[
          styles.note,
          { backgroundColor: surface },
          shadows.card as ViewStyle,
        ]}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityHint="Ábrela a pantalla completa"
      >
        <View style={styles.noteHead}>
          <AuthorAvatar name={author} color={fill} size={38} />
          <View style={styles.flex}>
            <Text
              style={[styles.noteName, { color: roles.text }]}
              numberOfLines={1}
            >
              {name || 'Anónimo'}
            </Text>
            {meta ? (
              <Text
                style={[styles.noteMeta, { color: roles.textMuted }]}
                numberOfLines={1}
              >
                {meta}
              </Text>
            ) : null}
          </View>
          <MaterialIcons
            name="format-quote"
            size={30}
            color={hexAlpha(toneInk, '8C')}
          />
        </View>
        {r.titulo ? (
          <Text style={[styles.noteTitle, { color: roles.text }]}>
            {r.titulo}
          </Text>
        ) : null}
        <Text
          style={[styles.noteBody, { color: roles.text }]}
          numberOfLines={long ? 9 : undefined}
        >
          {r.contenido.trim()}
        </Text>
        {long ? (
          <Text style={[styles.more, { color: toneInk }]}>Seguir leyendo</Text>
        ) : null}
      </PressableScale>
    </Animated.View>
  );
}

export default React.memo(ReflexionCard);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  poster: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    overflow: 'visible',
  },
  posterQuote: { marginLeft: -spacing.xs, marginBottom: -spacing.sm },
  posterXl: {
    ...typography.h1,
    lineHeight: 35,
    letterSpacing: -0.6,
  },
  posterLg: {
    ...typography.h2,
    lineHeight: 29,
    letterSpacing: -0.3,
  },
  posterFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  posterName: { ...typography.subhead, fontWeight: '600' },
  posterMeta: { ...typography.footnote, marginTop: 1 },
  note: {
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  noteHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  noteName: { ...typography.button },
  noteMeta: { ...typography.caption, marginTop: 1 },
  noteTitle: { ...typography.h3, marginTop: spacing.xs },
  noteBody: { ...typography.body, lineHeight: 25 },
  more: { ...typography.subhead, fontWeight: '600' },
});

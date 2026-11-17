/**
 * Al cerrar la hoja con el metrónomo sonando: «¿Dejarlo sonando?». El «Sí» es
 * grande (se contesta con el móvil en el atril y la guitarra en la otra mano);
 * «No volver a preguntar» guarda la respuesta para siempre (se cambia en la
 * hoja del metrónomo). Va pintado dentro del cantoral, no en un `Modal`: así
 * no choca con la hoja nativa que se está cerrando.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { PressableFeedback } from 'heroui-native';
import PressableScale from '@/components/ui/PressableScale';
import { MaterialIcons } from '@/components/ui/icons';
import { UIColors, themeColors } from '@/constants/colors';
import { durations } from '@/constants/animations';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import { useMetronome } from '@/contexts/MetronomeContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { onColor } from '@/utils/colorUtils';
import { h } from '@/utils/haptics';

/** El «Sí»: grande y cómodo de pulsar. */
const YES_HEIGHT = 64;
/** Área táctil mínima (design.md §1). */
const TOUCH = 48;
/** Ancho máximo de la tarjeta en pantallas grandes. */
const MAX_WIDTH = 440;

export default function KeepMetronomePrompt() {
  const m = useMetronome();
  const isDark = useColorScheme() === 'dark';
  const theme = themeColors(isDark);
  const bottom = useTabBarClearance(spacing.md);
  const [remember, setRemember] = useState(false);
  const { asking, answer: answerCtx } = m;
  // Contesta y deja la casilla sin marcar para la próxima vez.
  const answer = useCallback(
    (keep: boolean, rememberIt: boolean) => {
      answerCtx(keep, rememberIt);
      setRemember(false);
    },
    [answerCtx],
  );

  // Android: «atrás» = dejarlo sonando, sin guardar nada.
  useEffect(() => {
    if (!asking) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      answer(true, false);
      return true;
    });
    return () => sub.remove();
  }, [asking, answer]);

  if (!asking) return null;

  const accent = theme.link;
  return (
    <Animated.View
      entering={FadeIn.duration(durations.base)}
      exiting={FadeOut.duration(durations.quick)}
      style={[styles.backdrop, { backgroundColor: UIColors.modalOverlay }]}
    >
      <View
        style={[
          styles.card,
          shadows.raised,
          { marginBottom: bottom, backgroundColor: theme.card },
        ]}
        accessibilityViewIsModal
      >
        <View style={styles.head}>
          <MaterialIcons name="timer" size={28} color={accent} />
          <Text
            style={[styles.title, { color: theme.text }]}
            accessibilityRole="header"
          >
            ¿Dejar el metrónomo sonando?
          </Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            Seguirá a {m.bpm} mientras ves la canción. Lo paras o lo cambias
            desde el botón de abajo.
          </Text>
        </View>

        <PressableScale
          onPress={() => {
            h.formSuccess();
            answer(true, remember);
          }}
          style={[styles.yes, { backgroundColor: accent }]}
          accessibilityRole="button"
          accessibilityLabel="Sí, que siga sonando"
        >
          <MaterialIcons name="check" size={26} color={onColor(accent)} />
          <Text
            style={[styles.yesText, { color: onColor(accent) }]}
            maxFontSizeMultiplier={1.4}
          >
            Sí, que siga sonando
          </Text>
        </PressableScale>

        <PressableFeedback
          onPress={() => {
            h.tap();
            answer(false, remember);
          }}
          style={[styles.no, { borderColor: theme.separator }]}
          accessibilityRole="button"
          accessibilityLabel="No, pararlo"
        >
          <Text style={[typography.button, { color: theme.text }]}>
            No, pararlo
          </Text>
        </PressableFeedback>

        <PressableFeedback
          onPress={() => {
            h.toggle();
            setRemember((r) => !r);
          }}
          style={styles.remember}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: remember }}
          accessibilityLabel="No volver a preguntar"
        >
          <MaterialIcons
            name={remember ? 'check-box' : 'check-box-outline-blank'}
            size={24}
            color={remember ? accent : theme.textSecondary}
          />
          <Text style={[typography.body, { color: theme.text }]}>
            No volver a preguntar
          </Text>
        </PressableFeedback>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  card: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  head: { alignItems: 'center', gap: spacing.sm },
  title: { ...typography.h3, textAlign: 'center' },
  body: { ...typography.body, textAlign: 'center' },
  yes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: YES_HEIGHT,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
  },
  yesText: { ...typography.title, fontWeight: '700' },
  no: {
    minHeight: TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  remember: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: TOUCH,
    alignSelf: 'center',
    paddingHorizontal: spacing.sm,
  },
});

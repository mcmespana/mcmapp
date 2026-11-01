import React, { useEffect } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { MaterialIcons } from '@/components/ui/icons';
import brand, { themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { durations, easings } from '@/constants/animations';
import useAnimatedValue from '@/hooks/useAnimatedValue';
import useUpdatePhrases from '@/hooks/useUpdatePhrases';
import { useColorScheme } from '@/hooks/useColorScheme';
import { h } from '@/utils/haptics';

interface Props {
  visible: boolean;
}

/** Cuánto se queda una frase antes de dar paso a la siguiente (ms). */
export const PHRASE_MS = 2600;
const SPIN_MS = 2800;
const PULSE_MS = 1400;
const SLIDE_MS = 1300;
const BAR_WIDTH = 160;
const BAR_HEIGHT = 6;
const SEGMENT_WIDTH = 64;

/**
 * Pantalla que tapa la app mientras se aplica una actualización OTA: «un
 * momentín» y una frase de las de casa. Sustituye al modal de «¿te
 * actualizas?» (`OTAUpdatePrompt`): ahora la app se actualiza sola, y esto es
 * lo que se ve durante los pocos segundos que dura la recarga.
 *
 * Es opaca a propósito (la recarga deja la UI congelada un instante y así no
 * se nota) y va con el `Animated` de core dentro de un `Modal`, que es donde
 * las animaciones de Reanimated no corren (ver `components/BottomSheet.tsx`).
 */
export default function OTAUpdatingOverlay({ visible }: Props) {
  const isDark = useColorScheme() === 'dark';
  const theme = themeColors(isDark);
  // El `Animated` de core no hereda «reducir movimiento»: se lee a mano.
  const reducedMotion = useReducedMotion();

  const phrase = useUpdatePhrases(visible, PHRASE_MS);

  const fade = useAnimatedValue(0);
  const phraseOpacity = useAnimatedValue(1);
  const spin = useAnimatedValue(0);
  const pulse = useAnimatedValue(0);
  const slide = useAnimatedValue(0);

  useEffect(() => {
    if (!visible) {
      fade.setValue(0);
      return;
    }
    h.success();
    AccessibilityInfo.announceForAccessibility(
      'Actualizando la app, un momento',
    );
    Animated.timing(fade, {
      toValue: 1,
      duration: durations.slow,
      easing: easings.standard,
      useNativeDriver: true,
    }).start();

    if (reducedMotion) {
      pulse.setValue(0.5);
      return;
    }
    const loops = [
      Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: SPIN_MS,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: PULSE_MS,
            easing: easings.standard,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: PULSE_MS,
            easing: easings.standard,
            useNativeDriver: true,
          }),
        ]),
      ),
      Animated.loop(
        Animated.timing(slide, {
          toValue: 1,
          duration: SLIDE_MS,
          easing: easings.standard,
          useNativeDriver: true,
        }),
      ),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [visible, reducedMotion, fade, spin, pulse, slide]);

  // Cada frase nueva entra con un fundido corto.
  useEffect(() => {
    if (!visible || reducedMotion) return;
    phraseOpacity.setValue(0);
    Animated.timing(phraseOpacity, {
      toValue: 1,
      duration: durations.slow,
      easing: easings.standard,
      useNativeDriver: true,
    }).start();
  }, [phrase, visible, reducedMotion, phraseOpacity]);

  const spinStyle = {
    transform: [
      {
        rotate: spin.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        }),
      },
    ],
  };
  const haloStyle = {
    opacity: pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.35, 0.7],
    }),
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [0.85, 1.08],
        }),
      },
    ],
  };
  const segmentStyle = {
    transform: [
      {
        translateX: slide.interpolate({
          inputRange: [0, 1],
          outputRange: [-SEGMENT_WIDTH, BAR_WIDTH],
        }),
      },
    ],
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      statusBarTranslucent
      // Sin salida: la recarga ya está en marcha. Android no debe poder cerrarlo.
      onRequestClose={() => {}}
    >
      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.root,
          { backgroundColor: theme.background, opacity: fade },
        ]}
      >
        <View style={styles.hero}>
          <Animated.View style={[styles.halo, haloStyle]} />
          <View style={styles.badge}>
            <Animated.View style={spinStyle}>
              <MaterialIcons name="autorenew" size={36} color="#fff" />
            </Animated.View>
          </View>
        </View>

        <Text
          accessibilityRole="header"
          style={[styles.title, { color: theme.text }]}
        >
          Un momentín…
        </Text>

        {/* Las frases rotan: a un lector de pantalla se le avisa una vez arriba
            y no se le recita cada una. */}
        <Animated.Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.phrase,
            { color: theme.textSecondary, opacity: phraseOpacity },
          ]}
        >
          {phrase}
        </Animated.Text>

        <View
          style={[styles.barTrack, { backgroundColor: theme.separator }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Animated.View style={[styles.barSegment, segmentStyle]} />
        </View>

        <Text style={[styles.note, { color: theme.textMuted }]}>
          No pierdes nada: la app se actualiza sola.
        </Text>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 112,
    marginBottom: spacing.sm,
  },
  halo: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: radii.pillFull,
    backgroundColor: brand.secondary,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.primary,
  },
  title: {
    ...typography.h2,
    textAlign: 'center',
  },
  phrase: {
    ...typography.body,
    textAlign: 'center',
    lineHeight: 23,
    maxWidth: 360,
    // Dos líneas de alto reservadas: al cambiar de frase el resto no salta.
    minHeight: 46,
  },
  barTrack: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: radii.pillFull,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  barSegment: {
    width: SEGMENT_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: radii.pillFull,
    backgroundColor: brand.info,
  },
  note: {
    ...typography.footnote,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});

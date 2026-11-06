import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import PressableScale from '@/components/ui/PressableScale';
import brand, { themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import { durations, easings } from '@/constants/animations';
import useAnimatedValue from '@/hooks/useAnimatedValue';
import useUpdatePhrases from '@/hooks/useUpdatePhrases';
import { useColorScheme } from '@/hooks/useColorScheme';
import { h } from '@/utils/haptics';

interface Props {
  visible: boolean;
  /**
   * «Cerrar y hacer más tarde». El botón sale a los `LATER_AFTER_MS`: antes, la
   * pantalla no tiene salida (la recarga suele tardar un par de segundos); si
   * pasado ese rato sigue, es que la conexión va justa y la persona no tiene
   * por qué esperar mirándola.
   */
  onDismiss?: () => void;
}

/** Cuánto se queda una frase antes de dar paso a la siguiente (ms). */
export const PHRASE_MS = 2600;
/** A los cuántos segundos aparece «cerrar y hacer más tarde». */
export const LATER_AFTER_MS = 5000;
const ORBIT_MS = 3600;
const PULSE_MS = 1400;
const SLIDE_MS = 1300;
const STAGE_SIZE = 176;
const ICON_SIZE = 88;
const ORBIT_RADIUS = 76;
const DOT_SIZE = 12;
const BAR_WIDTH = 200;
const BAR_HEIGHT = 6;
const SEGMENT_WIDTH = 80;

/**
 * Tres puntos de los colores del logo que dan vueltas alrededor del icono,
 * separados 120°. Es decoración (vale en claro y oscuro), no información.
 */
const ORBIT_DOTS = [
  { angle: -90, color: brand.yellow },
  { angle: 30, color: brand.green },
  { angle: 150, color: brand.info },
].map(({ angle, color }) => {
  const rad = (angle * Math.PI) / 180;
  return {
    color,
    left: STAGE_SIZE / 2 + ORBIT_RADIUS * Math.cos(rad) - DOT_SIZE / 2,
    top: STAGE_SIZE / 2 + ORBIT_RADIUS * Math.sin(rad) - DOT_SIZE / 2,
  };
});

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
export default function OTAUpdatingOverlay({ visible, onDismiss }: Props) {
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
  const laterOpacity = useAnimatedValue(0);

  // «Cerrar y hacer más tarde» sale a los 5 s de estar la pantalla puesta.
  const [canDismiss, setCanDismiss] = useState(false);
  const [wasVisible, setWasVisible] = useState(visible);
  // Al cerrarse la pantalla, el botón se re-arma. Se ajusta durante el render
  // (como `useUpdatePhrases`) y no en un efecto.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (!visible) setCanDismiss(false);
  }
  useEffect(() => {
    if (!visible) {
      laterOpacity.setValue(0);
      return;
    }
    const timer = setTimeout(() => {
      setCanDismiss(true);
      AccessibilityInfo.announceForAccessibility(
        'Si tarda mucho, puedes cerrar y actualizar más tarde',
      );
      Animated.timing(laterOpacity, {
        toValue: 1,
        duration: durations.slow,
        easing: easings.standard,
        useNativeDriver: true,
      }).start();
    }, LATER_AFTER_MS);
    return () => clearTimeout(timer);
  }, [visible, laterOpacity]);

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
          duration: ORBIT_MS,
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
      outputRange: [0.25, 0.55],
    }),
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [0.9, 1.12],
        }),
      },
    ],
  };
  // El icono respira al compás del halo.
  const iconStyle = {
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.04],
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
      testID="ota-updating-overlay"
      visible={visible}
      animationType="none"
      statusBarTranslucent
      // Sin salida mientras la recarga va a tiro; pasados `LATER_AFTER_MS`,
      // atrás en Android hace lo mismo que el botón.
      onRequestClose={() => {
        if (canDismiss) onDismiss?.();
      }}
    >
      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.root,
          { backgroundColor: theme.background, opacity: fade },
        ]}
      >
        <View
          style={styles.hero}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Animated.View style={[styles.halo, haloStyle]} />
          <Animated.View style={[styles.orbit, spinStyle]}>
            {ORBIT_DOTS.map((d) => (
              <View
                key={d.color}
                style={[
                  styles.dot,
                  { left: d.left, top: d.top, backgroundColor: d.color },
                ]}
              />
            ))}
          </Animated.View>
          <Animated.View style={iconStyle}>
            <Image
              source={require('@/assets/images/icon.png')}
              style={styles.icon}
            />
          </Animated.View>
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

        {/* El hueco está siempre reservado: al aparecer el botón no se mueve
            nada. Hasta entonces no se puede tocar ni lo lee el lector. */}
        <Animated.View
          style={[styles.later, { opacity: laterOpacity }]}
          pointerEvents={canDismiss ? 'auto' : 'none'}
          accessibilityElementsHidden={!canDismiss}
          importantForAccessibility={canDismiss ? 'yes' : 'no-hide-descendants'}
        >
          <PressableScale
            onPress={() => {
              h.tap();
              onDismiss?.();
            }}
            disabled={!canDismiss}
            accessibilityRole="button"
            accessibilityLabel="Cerrar y actualizar más tarde"
            style={styles.laterButton}
          >
            <Text style={[styles.laterLabel, { color: theme.link }]}>
              Cerrar y hacer más tarde
            </Text>
          </PressableScale>
          <Text style={[styles.laterHint, { color: theme.textMuted }]}>
            La actualización sigue en segundo plano
          </Text>
        </Animated.View>
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
    width: STAGE_SIZE,
    height: STAGE_SIZE,
    marginBottom: spacing.sm,
  },
  halo: {
    position: 'absolute',
    width: 136,
    height: 136,
    borderRadius: radii.pillFull,
    backgroundColor: brand.secondary,
  },
  orbit: {
    position: 'absolute',
    width: STAGE_SIZE,
    height: STAGE_SIZE,
  },
  dot: {
    position: 'absolute',
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: radii.pillFull,
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: radii.xl,
    ...shadows.raised,
  },
  title: {
    ...typography.h1,
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
  later: {
    alignItems: 'center',
    gap: spacing.xs,
    // Alto del botón (44) + la ayuda, reservado desde el principio.
    minHeight: 72,
    marginTop: spacing.md,
  },
  laterButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterLabel: {
    ...typography.button,
  },
  laterHint: {
    ...typography.caption,
    textAlign: 'center',
  },
});

// La entrada en Comunica (14/11/2026): un círculo violeta con la marca de
// «hecho» que entra con un muelle y el saludo debajo. Dura lo justo para
// verse (`WELCOME_MS`) y luego la puerta pinta la portada. Con «Reducir
// movimiento», sin animación.

import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  ZoomIn,
  useReducedMotion,
} from 'react-native-reanimated';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { ACCESS_TEXT } from './copy';

/** Lo que se deja ver la entrada antes de pasar a la portada. */
export const WELCOME_MS = 900;

export default function WelcomeOverlay({ name }: { name: string }) {
  const t = useComunicaTheme();
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={reduced ? undefined : FadeIn.duration(180)}
      style={[styles.root, { backgroundColor: t.background }]}
      accessibilityLiveRegion="polite"
      accessible
      accessibilityLabel={ACCESS_TEXT.welcome(name)}
    >
      <Animated.View
        entering={
          reduced ? undefined : ZoomIn.springify().damping(12).delay(60)
        }
        style={[styles.circle, { backgroundColor: t.accentFill }]}
      >
        <IconSymbol name="checkmark" size={44} color={t.onAccent} />
      </Animated.View>
      <Animated.View
        entering={reduced ? undefined : FadeInDown.duration(260).delay(220)}
      >
        <Text style={[styles.title, { color: t.text }]}>
          {ACCESS_TEXT.welcome(name)}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    padding: 24,
  },
  circle: {
    width: 88,
    height: 88,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.h2, textAlign: 'center' },
});

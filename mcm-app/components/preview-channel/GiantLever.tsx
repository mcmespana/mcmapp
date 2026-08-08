import { useCallback } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from 'react-native-reanimated';

// Palanca gigante MUNDANO ↔ ALPHA que activa/desactiva el canal preview.
// Extraído de PreviewChannelModal.
//
// La posición es un `useDerivedValue` de la prop `active`, no un shared value
// escrito desde un `useEffect` como antes. Es la forma canónica de animar a
// partir de una prop en Reanimated, sin efecto de por medio: en cuanto `active`
// cambia —y el contexto lo cambia de forma optimista, antes de tocar la red— el
// mapper se recrea `dirty` y el muelle arranca en el frame siguiente.
//
// Ojo: el fallo original ("la palanca no se mueve") no se llegó a reproducir,
// así que esto NO es un arreglo con causa confirmada. Lo que sí quita es toda la
// fragilidad de la versión anterior: la animación dependía de que el estado
// diera la vuelta completa por el contexto, y el knob dependía de cómo resuelve
// Yoga un hijo absoluto sin `left`. Si vuelve a pasar, empezar por ahí.
//
// Y si el cambio de canal se revierte porque el binario lo rechaza, la palanca
// vuelve sola: esa vuelta ES la señal de que no ha cuajado (antes se quedaba
// donde el usuario la había dejado, mintiendo).

const LEVER_WIDTH = 280;
const LEVER_HEIGHT = 88;
const KNOB = 76;
const KNOB_MARGIN = 6;
const TRAVEL = LEVER_WIDTH - KNOB - KNOB_MARGIN * 2;
const SPRING = { damping: 12, stiffness: 110 } as const;

export function GiantLever({
  active,
  busy = false,
  onToggle,
}: {
  active: boolean;
  /** Cambio en curso: se bloquean pulsaciones para no encolar toggles. */
  busy?: boolean;
  onToggle: () => void;
}) {
  const t = useDerivedValue(() => withSpring(active ? 1 : 0, SPRING), [active]);

  const handlePress = useCallback(() => {
    if (busy) return;
    onToggle();
  }, [busy, onToggle]);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: t.value * TRAVEL },
      { rotate: `${interpolate(t.value, [0, 1], [-12, 12])}deg` },
      { scale: 1 + Math.abs(t.value - 0.5) * 0.05 },
    ],
  }));
  const trackOnStyle = useAnimatedStyle(() => ({ opacity: t.value }));

  return (
    <Pressable
      onPress={handlePress}
      disabled={busy}
      // Respuesta táctil por CSS, no por shared value: el React Compiler marca
      // como no fiable mutar un shared value desde un handler de evento.
      style={({ pressed }) => [
        styles.leverContainer,
        busy && styles.leverBusy,
        pressed && styles.leverPressed,
      ]}
      accessibilityRole="switch"
      accessibilityState={{ checked: active, disabled: busy }}
      accessibilityLabel="Activar modo laboratorio (canal preview)"
    >
      <View style={styles.leverTrackBase}>
        <Animated.View style={[styles.leverTrackOn, trackOnStyle]}>
          <LinearGradient
            colors={['#43E97B', '#FCD200', '#FE6B8B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <View style={styles.leverLabels} pointerEvents="none">
          <Text style={styles.leverLabel}>MUNDANO</Text>
          <Text style={styles.leverLabel}>ALPHA</Text>
        </View>
        <Animated.View style={[styles.leverKnob, knobStyle]}>
          <Text style={styles.leverKnobIcon} allowFontScaling={false}>
            {active ? '🧪' : '😴'}
          </Text>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  leverContainer: {
    width: LEVER_WIDTH,
    alignItems: 'center',
  },
  leverBusy: {
    opacity: 0.75,
  },
  leverPressed: {
    transform: [{ scale: 0.97 }],
  },
  leverTrackBase: {
    width: LEVER_WIDTH,
    height: LEVER_HEIGHT,
    borderRadius: LEVER_HEIGHT / 2,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  leverTrackOn: {
    ...StyleSheet.absoluteFill,
    borderRadius: LEVER_HEIGHT / 2,
    overflow: 'hidden',
  },
  leverLabels: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  leverLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 4,
  },
  leverKnob: {
    position: 'absolute',
    // `left` explícito: sin él la posición de partida dependía de cómo Yoga
    // resuelve un hijo absoluto sin offset horizontal, y el `translateX` tenía
    // que compensarlo con un `+6` a mano.
    left: KNOB_MARGIN,
    top: (LEVER_HEIGHT - KNOB) / 2,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(0,0,0,0.18)',
    ...Platform.select({
      web: { boxShadow: '0 6px 14px rgba(0,0,0,0.45)' } as any,
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.45,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 10,
        elevation: 10,
      },
    }),
  },
  leverKnobIcon: {
    fontSize: 36,
  },
});

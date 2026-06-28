import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

// Palanca gigante MUNDANO ↔ ALPHA que activa/desactiva el canal preview.
// Extraído de PreviewChannelModal.

const LEVER_WIDTH = 280;
const LEVER_HEIGHT = 88;
const KNOB = 76;

export function GiantLever({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  const t = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    t.value = withSpring(active ? 1 : 0, { damping: 12, stiffness: 110 });
  }, [active, t]);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: t.value * (LEVER_WIDTH - KNOB - 12) + 6 },
      { rotate: `${interpolate(t.value, [0, 1], [-12, 12])}deg` },
      { scale: 1 + Math.abs(t.value - 0.5) * 0.05 },
    ],
  }));
  const trackOnStyle = useAnimatedStyle(() => ({ opacity: t.value }));

  return (
    <Pressable
      onPress={onToggle}
      style={styles.leverContainer}
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
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
    ...StyleSheet.absoluteFillObject,
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

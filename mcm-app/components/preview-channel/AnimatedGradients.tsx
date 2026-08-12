import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

// Capa de gradientes morphing del "Laboratorio Alpha": tres gradientes que
// respiran (fade in/out) escalonados para crear un fondo en movimiento
// continuo. Extraído de PreviewChannelModal.

const GRADIENT_DURATION = 4000;
const GRADIENT_HOLD = 0;

export function AnimatedGradients() {
  const a = useSharedValue(1);
  const b = useSharedValue(0);
  const c = useSharedValue(0);

  useEffect(() => {
    const totalCycle = GRADIENT_DURATION * 3 + GRADIENT_HOLD * 3;
    const breathe = (start: number, sv: typeof a) => {
      sv.value = withDelay(
        start,
        withRepeat(
          withSequence(
            withTiming(1, { duration: GRADIENT_DURATION }),
            withTiming(0, { duration: GRADIENT_DURATION }),
            withTiming(0, { duration: totalCycle - GRADIENT_DURATION * 2 }),
          ),
          -1,
          false,
        ),
      );
    };
    // A empieza ya visible; B y C entran escalonadas.
    a.value = 1;
    b.value = 0;
    c.value = 0;
    breathe(0, a);
    breathe(GRADIENT_DURATION, b);
    breathe(GRADIENT_DURATION * 2, c);
    return () => {
      cancelAnimation(a);
      cancelAnimation(b);
      cancelAnimation(c);
    };
  }, [a, b, c]);

  const styleA = useAnimatedStyle(() => ({ opacity: a.value }));
  const styleB = useAnimatedStyle(() => ({ opacity: b.value }));
  const styleC = useAnimatedStyle(() => ({ opacity: c.value }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, styleA]}>
        <LinearGradient
          colors={['#FF8E53', '#FE6B8B', '#F4C11E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styleB]}>
        <LinearGradient
          colors={['#6A11CB', '#2575FC', '#00C9A7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styleC]}>
        <LinearGradient
          colors={['#43E97B', '#38F9D7', '#5B86E5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

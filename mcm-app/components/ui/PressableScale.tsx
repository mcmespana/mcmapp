import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  /** Desactiva el scale (donde el movimiento distraería). */
  staticScale?: boolean;
  /** Escala objetivo al pulsar. Por defecto 0.96 (nunca por debajo de 0.95). */
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * Pressable con feedback táctil de escala (`scale(0.96)` al pulsar), interrumpible
 * (usa `withTiming`, que se puede cortar a mitad). Reemplaza a `TouchableOpacity`
 * en cards/botones donde el "scale on press" se siente mejor que el dim de
 * opacidad.
 *
 * Principio de la skill make-interfaces-feel-better: usar exactamente `0.96` —
 * valores por debajo de `0.95` se sienten exagerados. Anima solo `transform`
 * (nunca `all`).
 */
export default function PressableScale({
  staticScale = false,
  scaleTo = 0.96,
  style,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      style={[style, animatedStyle]}
      onPressIn={(e) => {
        if (!staticScale) {
          scale.value = withTiming(scaleTo, {
            duration: 90,
            easing: Easing.out(Easing.quad),
          });
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!staticScale) {
          scale.value = withTiming(1, {
            duration: 140,
            easing: Easing.out(Easing.quad),
          });
        }
        onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}

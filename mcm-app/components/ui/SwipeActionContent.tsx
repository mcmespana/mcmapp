import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

interface SwipeActionContentProps {
  /** `translation` que recibe `renderLeftActions`/`renderRightActions`. */
  translation: SharedValue<number>;
  /** Píxeles arrastrados (negativos al abrir por la derecha). */
  inputRange: [number, number];
  /** Valor de `property` en cada extremo de `inputRange`. */
  outputRange: [number, number];
  property: 'translateX' | 'scale';
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/**
 * Contenido de una acción de deslizar (`ReanimatedSwipeable`) que se desplaza
 * o escala según lo arrastrado. Hace de `dragX.interpolate(...)` del antiguo
 * `Swipeable`, que gesture-handler 3 ya no trae.
 */
export default function SwipeActionContent({
  translation,
  inputRange,
  outputRange,
  property,
  style,
  children,
}: SwipeActionContentProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const value = interpolate(
      translation.value,
      inputRange,
      outputRange,
      Extrapolation.CLAMP,
    );
    return property === 'scale'
      ? { transform: [{ scale: value }] }
      : { transform: [{ translateX: value }] };
  });

  return (
    <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
  );
}

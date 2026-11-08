import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { springs } from '@/constants/animations';

/** Cuánto crece la acción al «armarse» (soltar ya la ejecuta). */
const ARMED_SCALE = 1.15;

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
  /**
   * Píxeles arrastrados (en valor absoluto) a partir de los cuales SOLTAR ya
   * ejecuta la acción: normalmente el umbral de `ReanimatedSwipeable` (la
   * mitad del ancho de las acciones si no se le pasa otro). Al cruzarlo, el
   * contenido da un pequeño salto (muelle) y se llama a `onArm`, que es el
   * sitio de la háptica: así el usuario SABE, sin mirar, que ya puede soltar.
   * Es el patrón de Mail en iOS. Sin `armAt`, nada de esto.
   */
  armAt?: number;
  /** Se llama (en JS) cada vez que el arrastre cruza `armAt` hacia fuera. */
  onArm?: () => void;
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
  armAt,
  onArm,
}: SwipeActionContentProps) {
  const armScale = useSharedValue(1);

  // Un valor ENLAZADO al arrastre (no una animación aparte): solo cambia al
  // cruzar el umbral, y entonces salta con un muelle. Una háptica por cruce,
  // nunca por frame.
  useAnimatedReaction(
    () => (armAt === undefined ? false : Math.abs(translation.value) >= armAt),
    (armed, prev) => {
      if (prev === null || armed === prev) return;
      armScale.set(withSpring(armed ? ARMED_SCALE : 1, springs.snap));
      if (armed && onArm) scheduleOnRN(onArm);
    },
    [armAt, onArm],
  );

  const animatedStyle = useAnimatedStyle(() => {
    const value = interpolate(
      translation.value,
      inputRange,
      outputRange,
      Extrapolation.CLAMP,
    );
    return property === 'scale'
      ? { transform: [{ scale: value * armScale.get() }] }
      : { transform: [{ translateX: value }, { scale: armScale.get() }] };
  });

  return (
    <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
  );
}

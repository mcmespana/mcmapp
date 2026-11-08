/**
 * Física de gestos compartida (skill `gestures` de Emil Kowalski).
 *
 * Todo gesto tiene dos fases:
 *   · SEGUIR (dedo abajo): la posición es la del dedo, 1:1. Sin curva ni
 *     muelle. Pasado un tope, resistencia elástica (`rubberBand`), nunca un
 *     tope seco.
 *   · SOLTAR (dedo arriba): termina la física — un muelle que hereda la
 *     velocidad del dedo. Se compromete por distancia **o** velocidad
 *     (`shouldCommitGesture`): un flick corto basta.
 *
 * Las funciones llevan `'worklet'`: se llaman desde los `onUpdate`/`onEnd` de
 * gesture-handler (hilo de UI) y también desde JS normal (PanResponder, tests).
 */

/**
 * Cuánto cede un elemento por cada px que el dedo sigue tirando más allá de
 * su tope. 0,2 es el `dragElastic` de Motion: se nota que hay un tope sin
 * sentirse como chocar contra una pared.
 */
export const RUBBER_BAND = 0.2;

/** Desplazamiento con resistencia elástica: 1:1 hasta `limit`, luego cede. */
export function rubberBand(
  offset: number,
  limit = 0,
  factor = RUBBER_BAND,
): number {
  'worklet';
  const abs = Math.abs(offset);
  if (abs <= limit) return offset;
  return Math.sign(offset) * (limit + (abs - limit) * factor);
}

/** Lleva `value` dentro de [min, max] con resistencia elástica fuera. */
export function rubberBandClamp(
  value: number,
  min: number,
  max: number,
  factor = RUBBER_BAND,
): number {
  'worklet';
  if (value < min) return min - (min - value) * factor;
  if (value > max) return max + (value - max) * factor;
  return value;
}

/**
 * ¿Se compromete el gesto al soltar? Distancia **o** velocidad, siempre en la
 * misma dirección del desplazamiento (un flick hacia atrás al final de un
 * arrastre largo es el usuario arrepintiéndose: no se compromete).
 *
 * @param translation desplazamiento acumulado (px, con signo)
 * @param velocity velocidad al soltar (mismas unidades que `velocityThreshold`)
 */
export function shouldCommitGesture(
  translation: number,
  velocity: number,
  distanceThreshold: number,
  velocityThreshold: number,
): boolean {
  'worklet';
  if (translation === 0) return Math.abs(velocity) > velocityThreshold;
  const dir = Math.sign(translation);
  // Soltar moviéndose en contra de lo arrastrado anula el gesto.
  if (velocity * dir < -velocityThreshold) return false;
  return (
    Math.abs(translation) > distanceThreshold ||
    velocity * dir > velocityThreshold
  );
}

/**
 * Un muelle de token (`springs.*`, forma de Apple: `duration` + `dampingRatio`)
 * traducido a lo que entiende `Animated.spring` de core (stiffness/damping/mass).
 * Con masa 1: ω = 2π / respuesta → k = ω², c = 2·ζ·ω.
 *
 * Para los sitios que siguen en core a propósito (BottomSheet, por el Modal
 * transparente): así no hace falta un muelle a mano con tension/friction.
 */
export function toCoreSpring(spec: {
  duration: number;
  dampingRatio: number;
}): { stiffness: number; damping: number; mass: number } {
  const omega = (2 * Math.PI) / (spec.duration / 1000);
  return {
    stiffness: omega * omega,
    damping: 2 * spec.dampingRatio * omega,
    mass: 1,
  };
}

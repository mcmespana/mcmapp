/**
 * Qué lado de acciones ha quedado ABIERTO en una fila deslizable.
 *
 * `ReanimatedSwipeable` (gesture-handler 3) llama a `onSwipeableOpen` con la
 * dirección HACIA LA QUE SE MOVIÓ la fila, no con el lado que se abrió:
 *   · deslizar a la izquierda (`'left'`) destapa las acciones de la DERECHA
 *     (`renderRightActions`);
 *   · deslizar a la derecha (`'right'`) destapa las de la IZQUIERDA.
 * El `Swipeable` viejo daba el lado. Al migrar se mantuvo la comparación de
 * antes y deslizar del todo dejaba la fila abierta sin hacer nada (build de
 * TestFlight de Expo 58, cantoral y playlist). Se compara siempre con esto.
 */
export type SwipeSide = 'left' | 'right';

export function openedActionsSide(direction: string): SwipeSide {
  return direction === 'left' ? 'right' : 'left';
}

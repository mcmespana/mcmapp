// Regla de compactar/expandir la barra flotante de pestañas.
//
// Vive aparte del controlador por dos motivos: la usan DOS caminos distintos
// (el worklet de scroll de Reanimated y el `onScroll` por JS del WebView de
// Comunica) y, sobre todo, porque así se puede probar sin montar nada.
//
// Es una función pura: se le da el estado actual y las métricas del scroll, y
// devuelve el estado siguiente. Lleva la directiva `'worklet'` para poder
// llamarla desde el hilo de UI.

/** Recorrido hacia abajo que compacta la barra. */
export const COLLAPSE_AT = 5;
/**
 * Recorrido hacia arriba que la vuelve a expandir. Es MUCHO mayor que
 * `COLLAPSE_AT` a propósito: compactar tiene que salir casi solo, y expandir
 * tiene que ser una intención clara. Con umbrales simétricos cualquier temblor
 * del dedo devolvía la barra a grande justo cuando estabas leyendo.
 */
export const EXPAND_AT = 40;
/** Por debajo de este offset la barra siempre se muestra expandida. */
export const ARM_AT = 12;

export interface CollapseState {
  /** Punto desde el que se mide el recorrido. Persigue al extremo alcanzado. */
  anchor: number;
  compact: boolean;
  /**
   * ¿Ha arrastrado el usuario en esta pantalla? Mientras sea `false` no se
   * aplica la regla de "arriba del todo siempre expandida", para que al entrar
   * en una pantalla anidada (una canción, un item de Más…) el primer evento de
   * scroll del scroller recién montado no expanda la barra él solo.
   */
  interacted: boolean;
}

export interface ScrollMetrics {
  /** Offset crudo, tal cual lo da el evento (puede ser negativo). */
  y: number;
  /** Offset mínimo real: `-contentInset.top`. */
  minY: number;
  /** Offset máximo real, o `null` si aún no se conoce el alto del contenido. */
  maxY: number | null;
}

/**
 * Recorta el rebote elástico. Sin esto, al llegar abajo del todo el rebote se
 * leía como "el usuario está subiendo" y expandía la barra sola — que es
 * exactamente el bug que se reportó.
 */
export function clampOffset({ y, minY, maxY }: ScrollMetrics): number {
  'worklet';
  if (y < minY) return minY;
  if (maxY !== null && maxY > minY && y > maxY) return maxY;
  return y;
}

/** Estado siguiente de la barra a partir del actual y del scroll recibido. */
export function collapseStep(
  state: CollapseState,
  metrics: ScrollMetrics,
): CollapseState {
  'worklet';
  const y = clampOffset(metrics);
  const { minY } = metrics;

  // Pantalla recién montada: hasta que el usuario no arrastre, el ancla se
  // limita a seguir al offset y la barra NO cambia. Sin esto, el primer evento
  // de un scroller nuevo (que en las pantallas con header grande llega ya en
  // `-inset`, muy lejos del ancla inicial) expandía la barra él solo.
  if (!state.interacted) {
    return { anchor: y, compact: state.compact, interacted: false };
  }

  // Arriba del todo (contando el inset del header grande) siempre expandida.
  if (y <= minY + ARM_AT) {
    return { anchor: y, compact: false, interacted: state.interacted };
  }

  const dy = y - state.anchor;

  if (state.compact) {
    // Compacta: el ancla persigue el punto MÁS BAJO alcanzado, así el recorrido
    // para expandir se mide desde donde el usuario dio la vuelta de verdad.
    if (dy < -EXPAND_AT) {
      return { anchor: y, compact: false, interacted: state.interacted };
    }
    if (dy > 0) {
      return { anchor: y, compact: true, interacted: state.interacted };
    }
    return state;
  }

  // Expandida: el ancla persigue el punto MÁS ALTO alcanzado.
  if (dy > COLLAPSE_AT) {
    return { anchor: y, compact: true, interacted: state.interacted };
  }
  if (dy < 0) {
    return { anchor: y, compact: false, interacted: state.interacted };
  }
  return state;
}

// Enganche de una pantalla a la barra de pestañas flotante.
//
// Dos cosas a la vez, que es lo que necesita cualquier pantalla de tab:
//   1. `onScroll` → compacta/expande la barra al scrollear.
//   2. `contentPaddingBottom` → hueco para que la barra, que ahora FLOTA sobre
//      el contenido, no tape el final de la lista.
//
// Hay dos variantes porque el controlador de la librería habla en ScrollView
// (`scrollTo`) y las listas hablan en offsets (`scrollToOffset` /
// `scrollToLocation`). La variante de lista registra un adaptador para que el
// re-tap del tab activo siga mandando la lista arriba del todo.

import { useEffect, useRef } from 'react';
import type { ScrollView } from 'react-native';

import { tabBarController } from '@/components/tabs/tabBarController';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';

/**
 * Para pantallas cuyo scroller raíz es un `Animated.ScrollView`.
 *
 * @param tabName `name` del tab en TABS_CONFIG — identifica el scroller para
 *   el scroll-arriba del re-tap. `null` en pantallas ANIDADAS dentro de un tab
 *   (detalle de canción, subrutas de Contigo…): colapsan la barra igual, pero
 *   no se registran para no pisar al scroller raíz del tab.
 * @param extraPadding espacio extra sobre el hueco de la barra (FABs, barras
 *   de acciones flotantes…).
 */
export function useTabScroll(tabName: string | null, extraPadding = 0) {
  const { scrollRef, onScroll } = tabBarController.useCollapsingScroll(
    tabName ?? undefined,
  );
  const contentPaddingBottom = useTabBarClearance(extraPadding);

  return { scrollRef, onScroll, contentPaddingBottom };
}

type ScrollToArgs = { y?: number; animated?: boolean };

/**
 * Para pantallas cuyo scroller raíz es un `Animated.FlatList` o
 * `Animated.SectionList`.
 *
 * Devuelve `listRef` para la lista y registra por dentro un adaptador que
 * traduce el `scrollTo({ y })` que usa el controlador al método que entiende
 * la lista. Sin esto, re-tapear el tab activo petaría (las listas no tienen
 * `scrollTo`).
 */
type ListLike = {
  scrollToOffset?: (params: { offset: number; animated?: boolean }) => void;
  scrollToLocation?: (params: {
    sectionIndex: number;
    itemIndex: number;
    animated?: boolean;
    viewOffset?: number;
  }) => void;
};

export function useTabListScroll<T>(tabName: string | null, extraPadding = 0) {
  const listRef = useRef<T>(null);
  const { scrollRef, onScroll } = tabBarController.useCollapsingScroll(
    tabName ?? undefined,
  );
  const contentPaddingBottom = useTabBarClearance(extraPadding);

  useEffect(() => {
    const adapter = {
      scrollTo: ({ y = 0, animated = true }: ScrollToArgs = {}) => {
        const list = listRef.current as ListLike | null;
        if (!list) return;
        if (list.scrollToOffset) {
          list.scrollToOffset({ offset: y, animated });
        } else if (list.scrollToLocation) {
          list.scrollToLocation({
            sectionIndex: 0,
            itemIndex: 0,
            animated,
            viewOffset: 0,
          });
        }
      },
    };

    scrollRef.current = adapter as unknown as ScrollView;
    return () => {
      if (scrollRef.current === (adapter as unknown as ScrollView)) {
        scrollRef.current = null;
      }
    };
  }, [scrollRef]);

  return { listRef, onScroll, contentPaddingBottom };
}

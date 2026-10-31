/**
 * Cambiar de pestaña SIN tocar su pila, como la barra del sistema.
 *
 * Nuestra barra (`CompactTabBar`) oculta la del sistema y pinta la suya, así
 * que el cambio de pestaña lo dispara ella. Con expo-router 58,
 * `router.navigate('/cancionero')` ya no «cambia de pestaña»: va a la RUTA
 * `/cancionero`, que es la portada de esa pila, y te sacaba de la canción o
 * la categoría en la que estabas al volver (build 61, cantoral y Contigo).
 *
 * La barra del sistema despacha `JUMP_TO` al navegador de pestañas, que
 * enfoca la pestaña tal y como se dejó. Aquí se hace lo mismo: se busca en el
 * estado de navegación el navegador de pestañas que tiene esa ruta y se le
 * manda `TabActions.jumpTo`. Si no se encuentra (no debería), se cae a
 * `router.navigate`.
 */
import { router } from 'expo-router';
import { TabActions } from 'expo-router/react-navigation';

interface StateLike {
  key?: string;
  type?: string;
  routeNames?: string[];
  routes?: { name: string; state?: StateLike }[];
}

/** Clave del navegador de pestañas que contiene la pestaña `tabName`. */
export function findTabNavigatorKey(
  state: StateLike | undefined,
  tabName: string,
): string | null {
  if (!state) return null;
  if (state.type === 'tab' && state.routeNames?.includes(tabName) && state.key)
    return state.key;
  for (const route of state.routes ?? []) {
    const found = findTabNavigatorKey(route.state, tabName);
    if (found) return found;
  }
  return null;
}

interface NavRefLike {
  getRootState(): unknown;
  dispatch(action: object): void;
}

export function jumpToTab(
  navRef: NavRefLike | null | undefined,
  tabName: string,
  fallbackHref: string,
): void {
  const key = navRef
    ? findTabNavigatorKey(navRef.getRootState() as StateLike, tabName)
    : null;
  if (navRef && key) {
    navRef.dispatch({ ...TabActions.jumpTo(tabName), target: key });
    return;
  }
  router.navigate(fallbackHref as never);
}

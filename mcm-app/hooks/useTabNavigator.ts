import { useCallback, useMemo } from 'react';

import { useVisibleTabs } from '@/hooks/useVisibleTabs';
import {
  navigateToInternalRoute,
  navigateToTab,
  resolveTabTarget,
  type TabNavigationOptions,
} from '@/utils/tabNavigation';

/**
 * Navegación a tabs que se adapta a la composición REAL de la barra (perfil +
 * evento archivado + tope de sitio) y a la plataforma. Ver
 * `utils/tabNavigation.ts` para el detalle del orden de fallbacks.
 *
 * ```tsx
 * const { goToTab } = useTabNavigator();
 * if (!goToTab('fotos')) toast.show({ ... }); // destino inalcanzable
 * ```
 */
export function useTabNavigator() {
  const visibleTabs = useVisibleTabs();

  const goToTab = useCallback(
    (tabName: string, options?: TabNavigationOptions) =>
      navigateToTab(tabName, visibleTabs, options),
    [visibleTabs],
  );

  const canOpenTab = useCallback(
    (tabName: string, options?: TabNavigationOptions) =>
      resolveTabTarget(tabName, visibleTabs, options).kind !== 'unavailable',
    [visibleTabs],
  );

  /** Abre una ruta interna (deep-link de notificación, chip de destino…). */
  const goToRoute = useCallback(
    (route: string) => navigateToInternalRoute(route, visibleTabs),
    [visibleTabs],
  );

  return useMemo(
    () => ({ goToTab, goToRoute, canOpenTab }),
    [goToTab, goToRoute, canOpenTab],
  );
}

export default useTabNavigator;

// hooks/useTabNavigation.ts
// Navegación a tabs que NO se equivoca de camino. Ver `utils/tabNavigation.ts`
// para el porqué (en iOS los tabs de overflow no tienen ruta registrada).

import { useCallback } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';

import { useVisibleTabs } from '@/hooks/useVisibleTabs';
import { useActiveMeta } from '@/contexts/ActiveEventContext';
import { setPendingMasScreen } from '@/utils/masNavigation';
import { setPendingEventScreen } from '@/utils/eventNavigation';
import {
  resolveEventScreenRoute,
  resolveTabRoute,
} from '@/utils/tabNavigation';

export interface TabNavigation {
  /** Va al tab indicado, entrando por "Más" si allí no tiene ruta propia. */
  goToTab: (tabName: string, params?: Record<string, unknown>) => void;
  /**
   * Va a una pantalla del stack del evento en curso (Evaluación, Reflexiones…),
   * por su tab si lo tiene o por "Más" si está en overflow.
   */
  goToEventScreen: (screen: string, params?: Record<string, unknown>) => void;
}

export function useTabNavigation(): TabNavigation {
  const visibleTabs = useVisibleTabs();
  const { activeEvent } = useActiveMeta();
  const eventTab = activeEvent.tabId
    ? { tabName: activeEvent.tabId, eventId: activeEvent.id }
    : undefined;
  const eventTabName = eventTab?.tabName;
  const eventId = eventTab?.eventId;

  const goToTab = useCallback(
    (tabName: string, params?: Record<string, unknown>) => {
      const route = resolveTabRoute(tabName, visibleTabs, {
        platform: Platform.OS,
        params,
        ...(eventTabName && eventId
          ? { eventTab: { tabName: eventTabName, eventId } }
          : {}),
      });

      if (route.via === 'tab') {
        if (route.params) {
          router.push({ pathname: route.path, params: route.params } as never);
        } else {
          router.push(route.path as never);
        }
        return;
      }

      // Por el stack de "Más": se apunta el destino y MasHomeScreen lo consume
      // al enfocarse (`utils/masNavigation.ts`).
      if (route.via === 'masScreen') {
        setPendingMasScreen(route.screen as never, route.params);
      }
      router.push('/mas');
    },
    [visibleTabs, eventTabName, eventId],
  );

  const goToEventScreen = useCallback(
    (screen: string, params?: Record<string, unknown>) => {
      if (!eventTabName || !eventId) return;
      const route = resolveEventScreenRoute(
        screen,
        { tabName: eventTabName, eventId },
        visibleTabs,
        Platform.OS,
      );
      if (route.via === 'eventTab') {
        setPendingEventScreen(screen, params);
        router.push(route.path as never);
        return;
      }
      setPendingMasScreen(route.screen as never, params);
      router.push('/mas');
    },
    [visibleTabs, eventTabName, eventId],
  );

  return { goToTab, goToEventScreen };
}

export default useTabNavigation;

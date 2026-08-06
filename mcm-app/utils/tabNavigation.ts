// utils/tabNavigation.ts
//
// Navegación RESILIENTE a un tab desde cualquier parte de la app (accesos
// directos de la Home, tarjetas de evento, tarjetas de "Más"…).
//
// ── El problema que resuelve ──
// Qué tabs existen NO es fijo: depende del perfil (`/profileConfig`), de si el
// evento en curso está archivado y de cuántos caben en la barra flotante
// (`MAX_TAB_BAR_ITEMS`). Además cada plataforma se comporta distinto:
//
//   · iOS   → `NativeTabs` sólo registra los tabs QUE ESTÁN EN LA BARRA. Un
//             `router.navigate('/fotos')` a un tab sin trigger no lleva a
//             ninguna parte.
//   · Android/Web → todas las rutas de `app/(tabs)/` existen aunque el tab no
//             se pinte en la barra.
//
// Antes cada llamador cableaba a mano su ruta ("Fotos siempre vive dentro de
// Más", "Calendario en iOS pasa por Más"). En cuanto cambia la composición de
// la barra —que cambia sin publicar versión, desde Firebase— esos atajos
// llevaban a "Más" a buscar una pantalla que ya no estaba ahí.
//
// ── Cómo lo resuelve ──
// `resolveTabTarget` elige, en este orden:
//   1. El tab, si está en la barra → ruta directa (siempre funciona).
//   2. Su equivalente dentro del stack de "Más" (Fotos, Calendario, Comunica y
//      el hub de cualquier evento están registrados ahí) → `/mas` + destino
//      pendiente.
//   3. La ruta directa igualmente, si la plataforma la tiene registrada
//      (Android/Web).
//   4. `unavailable` → el llamador avisa al usuario en vez de dejar un botón
//      que no hace nada.

import { Platform } from 'react-native';
import { router } from 'expo-router';

import { TABS_CONFIG, splitTabsForBar } from '@/constants/tabsCatalog';
import { getEventByTabId } from '@/constants/events';
import { hrefForTab } from '@/utils/tabRoutes';
import {
  clearPendingMasScreen,
  setPendingMasScreen,
} from '@/utils/masNavigation';
import {
  clearPendingEventScreen,
  setPendingEventScreen,
} from '@/utils/eventNavigation';
import { logger } from '@/utils/logger';

/**
 * Pantallas registradas en el stack de "Más" (`app/(tabs)/mas.tsx`): las
 * propias de Más + todas las sub-pantallas de evento (`renderEventScreens` con
 * `includeExtras`). Se listan aquí —en vez de importarlas— para no arrastrar
 * todas las pantallas del evento a este módulo de utilidades.
 *
 * Si añades una pantalla al stack de "Más", añádela también aquí.
 */
export const MAS_STACK_SCREENS: ReadonlySet<string> = new Set([
  'MasHome',
  'Fotos',
  'Calendario',
  'Comunica',
  'ComunicaGestion',
  'McmPanel',
  'EventosPasados',
  // Sub-pantallas de evento (app/screens/eventStackScreens.tsx)
  'JubileoHome',
  'Horario',
  'Materiales',
  'MaterialPages',
  'Visitas',
  'Profundiza',
  'Grupos',
  'Contactos',
  'Apps',
  'Reflexiones',
  'Evaluacion',
  'Comida',
  'ComidaWeb',
  'Wordle',
]);

/**
 * Tabs que tienen un gemelo dentro del stack de "Más": si el tab no está en la
 * barra, su contenido se sigue pudiendo abrir desde ahí.
 */
const MAS_TWIN_SCREENS: Record<string, string> = {
  fotos: 'Fotos',
  calendario: 'Calendario',
  comunica: 'Comunica',
};

export interface MasFallback {
  screen: string;
  params?: Record<string, unknown>;
}

/** Plan B dentro del stack de "Más" para un tab, o null si no lo hay. */
export function getMasFallbackForTab(tabName: string): MasFallback | null {
  const twin = MAS_TWIN_SCREENS[tabName];
  if (twin) return { screen: twin };

  // Los tabs de evento (Visita Papa, …) son un stack cuyo hub y sub-pantallas
  // también están registrados en "Más": basta con pasarle el eventId.
  const event = getEventByTabId(tabName);
  if (event) return { screen: 'JubileoHome', params: { eventId: event.id } };

  return null;
}

export type TabTarget =
  /** Navegar directo a la ruta del tab. */
  | { kind: 'tab'; tab: string }
  /** Ir a "Más" y saltar a esta pantalla dentro de su stack. */
  | { kind: 'mas'; screen: string; params?: Record<string, unknown> }
  /** No hay forma de llegar: el llamador debe avisar al usuario. */
  | { kind: 'unavailable' };

export interface TabNavigationOptions {
  /**
   * Ruta concreta a abrir cuando el tab SÍ es alcanzable (para sub-rutas del
   * tab, ej. `/(tabs)/contigo/evangelio`). Si falta, se usa la raíz del tab.
   */
  path?: string;
  /** Pantalla del stack del tab a la que saltar al aterrizar. */
  stackScreen?: string;
  stackParams?: Record<string, unknown>;
}

const isKnownTab = (tabName: string): boolean =>
  TABS_CONFIG.some((tab) => tab.name === tabName);

/**
 * Decide CÓMO llegar a un tab con la composición de barra actual.
 *
 * @param visibleTabs tabs visibles del perfil (`useVisibleTabs`).
 */
export function resolveTabTarget(
  tabName: string,
  visibleTabs: ReadonlySet<string>,
  options: TabNavigationOptions = {},
): TabTarget {
  const known = isKnownTab(tabName);

  // Si el llamador pide una pantalla concreta y el stack de "Más" la tiene,
  // ese es el plan B (más preciso que el gemelo genérico del tab).
  const fallback: MasFallback | null =
    options.stackScreen && MAS_STACK_SCREENS.has(options.stackScreen)
      ? { screen: options.stackScreen, params: options.stackParams }
      : getMasFallbackForTab(tabName);

  // Web: barra clásica con TODOS los tabs visibles, sin tope de sitio.
  if (Platform.OS === 'web') {
    if (known && visibleTabs.has(tabName)) return { kind: 'tab', tab: tabName };
    if (fallback && visibleTabs.has('mas')) return { kind: 'mas', ...fallback };
    if (known) return { kind: 'tab', tab: tabName };
    return { kind: 'unavailable' };
  }

  const { mainTabs } = splitTabsForBar(visibleTabs);
  const inBar = (name: string) => mainTabs.some((tab) => tab.name === name);

  if (inBar(tabName)) return { kind: 'tab', tab: tabName };
  if (fallback && inBar('mas')) return { kind: 'mas', ...fallback };
  // Android registra las rutas de archivo aunque el tab no esté en la barra;
  // iOS no (`NativeTabs` sólo monta los triggers de la barra).
  if (known && Platform.OS !== 'ios') return { kind: 'tab', tab: tabName };

  return { kind: 'unavailable' };
}

/**
 * Navega a un tab por la mejor vía disponible.
 *
 * @returns `false` si no hay ninguna vía (el llamador debería avisar al
 * usuario en vez de dejar el botón mudo).
 */
export function navigateToTab(
  tabName: string,
  visibleTabs: ReadonlySet<string>,
  options: TabNavigationOptions = {},
): boolean {
  const target = resolveTabTarget(tabName, visibleTabs, options);

  switch (target.kind) {
    case 'tab': {
      // Un destino pendiente anterior que nadie llegó a consumir no debe
      // dispararse ahora, en una pantalla que no lo esperaba.
      clearPendingMasScreen();
      clearPendingEventScreen();
      if (options.stackScreen) {
        if (tabName === 'mas') {
          // Si "Más" ya está delante, el destino se consume en el acto y
          // navegar a `/mas` desharía ese salto volviendo a la raíz.
          const consumed = setPendingMasScreen(
            options.stackScreen as never,
            options.stackParams,
          );
          if (consumed) return true;
        } else if (getEventByTabId(tabName)) {
          setPendingEventScreen(options.stackScreen, options.stackParams);
        }
      }
      router.navigate((options.path ?? hrefForTab(target.tab)) as never);
      return true;
    }
    case 'mas': {
      clearPendingEventScreen();
      const consumed = setPendingMasScreen(
        target.screen as never,
        target.params,
      );
      if (!consumed) router.navigate('/mas');
      return true;
    }
    default:
      logger.warn(
        `[tabNavigation] Sin ruta disponible para el tab "${tabName}"`,
      );
      return false;
  }
}

/**
 * Nombre del tab al que pertenece una ruta interna
 * (`/(tabs)/contigo/evangelio` → `contigo`, `/` → `index`). Null si la ruta no
 * cuelga de ningún tab (`/wordle`, `/notifications`…).
 */
export function tabNameFromRoute(route: string): string | null {
  const path = route.split('?')[0].split('#')[0];
  const segments = path
    .split('/')
    .filter(Boolean)
    .filter((segment) => segment !== '(tabs)');

  if (segments.length === 0) return 'index'; // "/" es la Home
  return isKnownTab(segments[0]) ? segments[0] : null;
}

/**
 * Navega a una ruta interna arbitraria (deep-link de notificación, chip de
 * destino…) sin dar por hecho que el tab de esa ruta esté en la barra: si
 * cuelga de un tab, se resuelve con `navigateToTab`.
 *
 * @returns `false` si no se pudo navegar.
 */
export function navigateToInternalRoute(
  route: string,
  visibleTabs: ReadonlySet<string>,
): boolean {
  const clean = (route ?? '').trim();
  if (!clean) return false;

  const tabName = tabNameFromRoute(clean);
  if (tabName) return navigateToTab(tabName, visibleTabs, { path: clean });

  try {
    router.push(clean as never);
    return true;
  } catch (error) {
    logger.error(`[tabNavigation] No se pudo abrir "${clean}"`, error);
    return false;
  }
}

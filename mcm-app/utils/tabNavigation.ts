// utils/tabNavigation.ts
// Cómo llegar a un TAB desde cualquier sitio (la Home, sobre todo).
//
// ## El problema que resuelve
//
// En **iOS** el navegador de pestañas es `NativeTabs`, y `IOSTabsLayout` solo
// registra un `NativeTabs.Trigger` por cada tab que cabe en la barra
// (`splitTabsForBar`, tope `MAX_TAB_BAR_ITEMS`). Los que se quedan fuera **no
// tienen ruta**: `router.push('/calendario')` no hace absolutamente nada.
// En **Android y web** están registrados TODOS los tabs visibles del perfil
// (solo la barra está recortada), así que allí el push directo siempre vale.
//
// Y qué tabs caben depende del perfil y de si hay un evento en curso, que es
// justo lo que hacía que la Home fallara de forma intermitente: decidía "voy
// directo o paso por Más" con heurísticas de su cosecha —`Platform.OS === 'ios'`,
// `resolved.tabs.includes(...)`, o directamente un `href` fijo— en vez de
// preguntar si el tab está DE VERDAD en la barra. Cuando no acertaba, el botón
// no llevaba a ninguna parte.
//
// ## La regla
//
// 1. ¿El tab tiene ruta propia aquí (Android/web siempre, iOS solo si está en la
//    barra)? → se va directo.
// 2. Si no, hay que entrar por el stack de "Más", que registra pantallas espejo
//    de los tabs que pueden quedar en overflow.
//
// Por el ORDEN de `TABS_CONFIG` (index, cancionero, contigo, comunica, evento,
// calendario, fotos, mas), el overflow solo puede contener `comunica`, el tab
// del evento, `calendario` y `fotos` — los cuatro con espejo en "Más". Si algún
// día se reordena y cae ahí un tab sin espejo, se aterriza en la raíz de "Más"
// (`masRoot`) en vez de no hacer nada.

import { splitTabsForBar } from '@/constants/tabsCatalog';

/**
 * Tabs con pantalla ESPEJO en el stack de "Más" (`app/(tabs)/mas.tsx`). Es la
 * única fuente de verdad: la consumen el resolver y las tarjetas de overflow de
 * `MasHomeScreen`.
 */
export const MAS_STACK_MIRROR: Readonly<Record<string, string>> = {
  fotos: 'Fotos',
  calendario: 'Calendario',
  comunica: 'Comunica',
};

/** Pantalla hub de un evento dentro del stack de "Más" (necesita `eventId`). */
export const MAS_EVENT_HUB_SCREEN = 'JubileoHome';

export type TabRoute =
  /** Ruta propia: `router.push(path)`. */
  | { via: 'tab'; path: string; params?: Record<string, unknown> }
  /** Por el stack de "Más", a una pantalla concreta. */
  | { via: 'masScreen'; screen: string; params?: Record<string, unknown> }
  /** Por el stack de "Más", sin destino: la tarjeta está en su portada. */
  | { via: 'masRoot' };

export interface ResolveTabRouteOptions {
  /** `Platform.OS`. iOS es el único que recorta las rutas registradas. */
  platform: string;
  /** Params para el destino (p. ej. `{ date }` del calendario). */
  params?: Record<string, unknown>;
  /**
   * Tab del evento en curso y su id. Sin esto, un tab de evento en overflow no
   * se puede resolver: su espejo en "Más" es el hub genérico, que necesita saber
   * de QUÉ evento hablamos.
   */
  eventTab?: { tabName: string; eventId: string };
}

/** Cómo llegar al tab `tabName` desde esta plataforma y este perfil. */
export function resolveTabRoute(
  tabName: string,
  visibleTabs: ReadonlySet<string>,
  { platform, params, eventTab }: ResolveTabRouteOptions,
): TabRoute {
  const direct: TabRoute = {
    via: 'tab',
    path: `/${tabName}`,
    ...(params && { params }),
  };

  const { mainTabs } = splitTabsForBar(visibleTabs);

  /**
   * ¿Ese tab tiene ruta registrada AQUÍ? En iOS solo los de la barra
   * (`NativeTabs.Trigger`); en Android y web, todos los visibles del perfil.
   */
  const hasRoute = (name: string) =>
    platform === 'ios'
      ? mainTabs.some((tab) => tab.name === name)
      : visibleTabs.has(name);

  const viaMas = (): TabRoute => {
    // Entrar por "Más" exige que "Más" TENGA ruta: si el perfil no lo trae, o no
    // cabe en la barra en iOS, `router.push('/mas')` es otro no-op. En ese caso
    // el intento directo es lo mejor que hay — en Android/web funciona, y en iOS
    // no hay ningún camino, así que no se pierde nada.
    if (!hasRoute('mas')) return direct;

    const mirror = MAS_STACK_MIRROR[tabName];
    if (mirror)
      return { via: 'masScreen', screen: mirror, ...(params && { params }) };
    if (eventTab?.tabName === tabName) {
      return {
        via: 'masScreen',
        screen: MAS_EVENT_HUB_SCREEN,
        params: { eventId: eventTab.eventId, ...params },
      };
    }
    return { via: 'masRoot' };
  };

  // Un tab sin ruta aquí puede ser de overflow (iOS) o directamente no estar en
  // el perfil (evento archivado, calendario apagado…). En los dos casos el
  // espejo de "Más" es la salida: `mas.tsx` registra Fotos, Calendario, Comunica
  // y las pantallas de evento SIEMPRE, mire el perfil lo que mire.
  return hasRoute(tabName) ? direct : viaMas();
}

/**
 * Cómo llegar a una pantalla del stack de un EVENTO (Evaluación, Reflexiones…).
 * Si el tab del evento tiene ruta propia se entra por él; si está en overflow se
 * entra por "Más", que registra las mismas pantallas de evento.
 */
export function resolveEventScreenRoute(
  screen: string,
  eventTab: { tabName: string; eventId: string },
  visibleTabs: ReadonlySet<string>,
  platform: string,
): { via: 'eventTab'; path: string } | { via: 'masScreen'; screen: string } {
  const route = resolveTabRoute(eventTab.tabName, visibleTabs, {
    platform,
    eventTab,
  });
  return route.via === 'tab'
    ? { via: 'eventTab', path: route.path }
    : { via: 'masScreen', screen };
}

import { createContext, useCallback, useContext } from 'react';
import { router } from 'expo-router';
import { useRoute } from 'expo-router/react-navigation';
import { getEvent, EventConfig } from '@/constants/events';
import { useActiveMeta } from '@/contexts/ActiveEventContext';
import {
  MAS_BASE,
  eventHref,
  type EventAnyScreenName,
  type EventBase,
} from '@/utils/eventRoutes';

/**
 * `eventId` por defecto de un stack de evento (p. ej. la pestaña propia de un
 * evento). Sustituye a `initialParams` de `Stack.Screen`, que expo-router 58
 * ya no admite. El route param, si lo hay, manda sobre este valor.
 */
export const EventIdContext = createContext<string | undefined>(undefined);

/**
 * Lee `eventId` del route param actual y devuelve la config del evento.
 * Si no hay eventId o es inválido, cae al evento activo según Firebase
 * (`activities/_meta.activeEventId`) o, sin conexión, al `ACTIVE_EVENT_ID`
 * hardcoded en `constants/events.ts`.
 *
 * Uso desde cualquier sub-pantalla montada en el MasStack:
 *
 *   const event = useCurrentEvent();
 *   useFirebaseData(
 *     getEventFirebasePath(event, 'horario'),
 *     getEventCacheKey(event, 'horario'),
 *   );
 */
export function useCurrentEvent(): EventConfig {
  const route = useRoute();
  const params = (route.params ?? {}) as { eventId?: string };
  const contextEventId = useContext(EventIdContext);
  const { activeEventId } = useActiveMeta();
  return getEvent(params.eventId ?? contextEventId ?? activeEventId);
}

/**
 * Raíz de rutas del stack donde está montada la pantalla de evento: `/mas`
 * (Jubileo y demás, apilados en «Más») o `/visitapapa` (la pestaña propia del
 * evento). La pone el layout de cada uno; por defecto, «Más».
 */
export const EventBaseContext = createContext<EventBase>(MAS_BASE);

/**
 * Navegar a otra pantalla del MISMO evento por su nombre de siempre
 * (`'Horario'`, `'Materiales'`…), sea cual sea el stack donde estés. Los params
 * viajan por URL: son texto (los números se convierten, los objetos no pasan).
 */
export function useEventNavigation() {
  const base = useContext(EventBaseContext);
  const open = useCallback(
    (screen: EventAnyScreenName, params?: Record<string, unknown>) => {
      router.push(eventHref(base, screen, params) as never);
    },
    [base],
  );
  return { open, base };
}

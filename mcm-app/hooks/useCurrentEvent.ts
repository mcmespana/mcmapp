import { useRoute } from '@react-navigation/native';
import { getEvent, EventConfig } from '@/constants/events';
import { useActiveMeta } from '@/contexts/ActiveEventContext';

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
  const { activeEventId } = useActiveMeta();
  return getEvent(params.eventId ?? activeEventId);
}

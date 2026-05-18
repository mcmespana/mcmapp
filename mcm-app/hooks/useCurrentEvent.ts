import { useRoute } from '@react-navigation/native';
import { getEvent, EventConfig } from '@/constants/events';

/**
 * Lee `eventId` del route param actual y devuelve la config del evento.
 * Si no hay eventId o es inválido, cae al evento por defecto (Jubileo).
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
  return getEvent(params.eventId);
}

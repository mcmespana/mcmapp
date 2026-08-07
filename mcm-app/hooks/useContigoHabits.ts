/**
 * Fachada del `ContigoHabitsContext`.
 *
 * El cuerpo de este hook vivía aquí con estado POR INSTANCIA, y en el stack de
 * Contigo hay cuatro instancias vivas a la vez, así que cada pantalla escribía
 * el mapa entero de hábitos desde el `records` de su propio closure y se
 * pisaban entre ellas (ver la cabecera del context para la secuencia exacta).
 * Ahora el dueño del mapa es el provider y esto es solo el acceso; la API
 * pública no ha cambiado, así que las pantallas no se tocan.
 */
import { useContigoHabitsContext } from '@/contexts/ContigoHabitsContext';

export type {
  DayRecord,
  Emotion,
  PrayerDuration,
  ContigoHabitsValue,
} from '@/contexts/ContigoHabitsContext';

export function useContigoHabits() {
  return useContigoHabitsContext();
}

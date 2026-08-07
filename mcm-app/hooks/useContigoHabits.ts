// Fachada: el estado real vive en ContigoHabitsContext (un solo dueño del
// mapa de hábitos compartido por las 4 pantallas de Contigo — ver el
// comentario en contexts/ContigoHabitsContext.tsx). Este hook existe para
// que los imports `from '@/hooks/useContigoHabits'' de las pantallas sigan
// compilando sin cambios.
import { useContigoHabitsContext } from '@/contexts/ContigoHabitsContext';

export type {
  PrayerDuration,
  Emotion,
  DayRecord,
} from '@/contexts/ContigoHabitsContext';

export function useContigoHabits() {
  return useContigoHabitsContext();
}

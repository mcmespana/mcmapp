// hooks/comunica/useCalendar.ts
//
// El calendario de la persona que se ve (`GET /v1/profiles/:pid/calendar`,
// plan 16). La portada (plan 11) saca de aquí «Próximas actividades», con la
// MISMA clave (`['comunica', 'calendar', pid]`): así la portada calienta el
// calendario. Se guarda en el móvil (actividades, fechas y marcas).

import { getComunicaApi } from '@/services/comunica';
import { STALE } from './useAreaQuery';
import { useProfileQuery } from './useProfileQuery';

export function useCalendar(enabled = true) {
  return useProfileQuery({
    block: 'calendar',
    route: 'profileCalendar',
    load: (pid) => getComunicaApi().getProfileCalendar(pid),
    staleTime: STALE.state,
    enabled,
  });
}

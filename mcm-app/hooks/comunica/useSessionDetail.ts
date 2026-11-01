// hooks/comunica/useSessionDetail.ts
//
// El detalle de una sesión del calendario (plan 16, C8): solo con inscripción
// activa a su evento (si no, 403: «Esta sesión ya no está disponible»). Sin
// conexión, lo que haya en el calendario guardado (sin la descripción).

import { getComunicaApi } from '@/services/comunica';
import type { SessionDetail } from '@/services/comunica/contract';
import { STALE } from './useAreaQuery';
import { useCalendar } from './useCalendar';
import { useProfileQuery } from './useProfileQuery';

export function useSessionDetail(id: string) {
  const q = useProfileQuery({
    block: 'calendar',
    rest: ['session', id],
    route: 'profileSession',
    load: (pid) => getComunicaApi().getProfileSession(pid, id),
    staleTime: STALE.state,
    retry: false,
  });
  const calendar = useCalendar();
  const fromCalendar = calendar.data?.sessions.find((s) => s.id === id);
  const fallback: SessionDetail | undefined = fromCalendar
    ? { ...fromCalendar, description: null }
    : undefined;
  return { ...q, session: q.data?.session ?? fallback };
}

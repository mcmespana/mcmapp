// El calendario (plan 16): `['calendar', pid]`, guardado en el móvil (actividades, fechas y marcas; ni documento, ni dirección, ni correo) para abrir rápido.
// Apuntarse (plan 14) lo invalida. La sesión se lee del calendario guardado y, si no está, del servidor (que exige inscripción activa a su evento).

import { getComunicaApi } from '@/services/comunica';
import { useQueryClient } from '@tanstack/react-query';
import { areaKey, STALE, useAreaQuery } from './useAreaQuery';

export const calendarKey = (pid: string) => ['calendar', pid] as const;

export function useCalendar(pid: string | null | undefined) {
  return useAreaQuery({
    key: [...calendarKey(pid ?? '')],
    route: 'profileCalendar',
    fetch: () => getComunicaApi().getProfileCalendar(pid!),
    staleTime: STALE.state,
    enabled: !!pid,
    retry: false,
  });
}

export function useSessionDetail(pid: string | null | undefined, id: string) {
  const qc = useQueryClient();
  return useAreaQuery({
    key: [...calendarKey(pid ?? ''), 'session', id],
    route: 'profileSession',
    fetch: () => getComunicaApi().getProfileSession(pid!, id),
    staleTime: STALE.state,
    enabled: !!pid && !!id,
    retry: false,
    // Sin red, la sesión sale del calendario guardado.
    placeholderData: () => {
      const cal = qc.getQueryData<{
        generatedAt: string;
        sessions: { id: string }[];
      }>(areaKey(calendarKey(pid ?? '')));
      const s = cal?.sessions.find((x) => x.id === id);
      return s
        ? ({
            generatedAt: cal!.generatedAt,
            session: { ...s, description: null },
          } as never)
        : undefined;
    },
  });
}

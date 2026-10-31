// Lecturas de Pasar Lista (plan 04 «Datos»). La estructura cambia poco; el
// estado, mucho.

import { getComunicaApi } from '@/services/comunica';
import { STALE, useAreaQuery } from './useAreaQuery';

export function useGroups() {
  return useAreaQuery({
    key: ['pasar-lista', 'groups'],
    fetch: () => getComunicaApi().getGroups(),
    staleTime: STALE.structure,
  });
}

export function useToday() {
  return useAreaQuery({
    key: ['pasar-lista', 'today'],
    fetch: () => getComunicaApi().getToday(),
    staleTime: STALE.state,
  });
}

export function useRoll(sessionId: string, groupId: string) {
  return useAreaQuery({
    key: ['pasar-lista', 'roll', sessionId, groupId],
    fetch: () => getComunicaApi().getRoll(sessionId, groupId),
    staleTime: STALE.state,
    enabled: !!sessionId && !!groupId,
  });
}

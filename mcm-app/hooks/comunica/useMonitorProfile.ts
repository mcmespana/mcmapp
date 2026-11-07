// «Mis datos de monitor» (plan 09 «Datos»): la lectura y la escritura.
//
//   · La lectura se guarda en el móvil (son sus datos y no hay salud) y se
//     borra al salir, como todo lo del área.
//   · El `PATCH` va por la COLA con una sola clave (`me.monitor`): gana la
//     última, así que cada entrada lleva TODO lo que difiere de lo confirmado
//     (lo calcula `changesFrom`, no esta capa).

import { useCallback } from 'react';
import { getComunicaApi } from '@/services/comunica';
import { useArea } from '@/components/comunica/comun/ComunicaAreaProvider';
import {
  MONITOR_OUTBOX_KEY,
  MONITOR_OUTBOX_KIND,
  type MonitorChanges,
} from '@/utils/comunica/monitorProfile';
import { uuidV4 } from '@/utils/comunica/uuid';
import { STALE, useAreaQuery } from './useAreaQuery';
import { useOutbox } from './useOutbox';

export const MONITOR_PROFILE_KEY = ['yo', 'monitor'] as const;

export function useMyMonitorProfile(enabled = true) {
  return useAreaQuery({
    key: [...MONITOR_PROFILE_KEY],
    route: 'myMonitor',
    fetch: () => getComunicaApi().getMyMonitorProfile(),
    staleTime: STALE.state,
    enabled,
  });
}

/** Lo que espera en la cola para estos datos (si hay algo). */
export function usePendingMonitorChanges() {
  const { get } = useOutbox();
  const entry = get(MONITOR_OUTBOX_KEY);
  return {
    entry,
    changes:
      entry && entry.status !== 'applied'
        ? (entry.payload as { changes: MonitorChanges }).changes
        : null,
  };
}

export function useMonitorProfileWrites() {
  const { outbox } = useArea();
  /** Encola lo que difiere de lo confirmado; vacío = no queda nada que subir. */
  const save = useCallback(
    async (changes: MonitorChanges) => {
      if (!outbox) return;
      if (Object.keys(changes).length === 0) {
        await outbox.discard(MONITOR_OUTBOX_KEY);
        return;
      }
      await outbox.enqueue({
        key: MONITOR_OUTBOX_KEY,
        kind: MONITOR_OUTBOX_KIND,
        payload: { changes },
        clientId: uuidV4(),
      });
    },
    [outbox],
  );
  const retry = useCallback(() => outbox?.retry(MONITOR_OUTBOX_KEY), [outbox]);
  return { save, retry };
}

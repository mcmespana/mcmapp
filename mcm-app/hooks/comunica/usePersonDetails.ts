// «Mis datos» de familias (plan 12): la lectura y la escritura.
//
//   · NADA de esto se guarda en el móvil (familias, regla 8: documento,
//     dirección, correo; y la salud, siempre): `persist: false`, y en memoria
//     poco rato (datos 5 min, salud 1 min).
//   · Sin cola: se escribe directo, con conexión, con un `clientId` que se
//     repite en los reintentos del MISMO «Guardar» (la cola guarda el cuerpo
//     en disco, y aquí son datos personales y de salud).
//   · El contrato aún no tiene estas rutas en `ROUTES`: se declaran con las
//     de su misma clase (`personal` y `health`, las dos `persist: false`),
//     así `useAreaQuery` nunca las marca para guardar.

import { useCallback, useRef, useSyncExternalStore } from 'react';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { getComunicaApi } from '@/services/comunica';
import type {
  DetailsWriteResult,
  HealthWrite,
  PersonDetails,
  PersonDetailsWrite,
} from '@/services/comunica/contract';
import { uuidV4 } from '@/utils/comunica/uuid';
import { areaKey } from './useAreaQuery';
import { profileKey, useProfileQuery } from './useProfileQuery';

export const DETAILS_GC_MS = 5 * 60_000;
export const HEALTH_GC_MS = 60_000;

/** Los datos de `pid` (la pantalla es personal: va con SU pid). */
export function usePersonDetails(pid: string | null) {
  return useProfileQuery({
    block: 'datos',
    route: 'personal',
    pid,
    load: (p) => getComunicaApi().getProfileDetails(p),
    persist: false,
    gcTime: DETAILS_GC_MS,
    staleTime: 0,
  });
}

/** La salud de `pid`: sin reintentos (o llega, o «sin conexión»). */
export function useProfileHealth(pid: string | null, enabled = true) {
  return useProfileQuery({
    block: 'salud',
    route: 'health',
    pid,
    load: (p) => getComunicaApi().getProfileHealth(p),
    persist: false,
    gcTime: HEALTH_GC_MS,
    staleTime: 0,
    retry: false,
    enabled,
  });
}

/**
 * Guardar: el `PATCH` si cambió algo de los datos y el `PUT` si cambió la
 * salud. Un reintento con el mismo cuerpo lleva el mismo `clientId`.
 */
export function useSaveDetails(pid: string | null) {
  const qc = useQueryClient();
  const ids = useRef<{ body: string; id: string }[]>([]);

  return useCallback(
    async (writes: {
      details: PersonDetailsWrite['changes'] | null;
      health: HealthWrite['health'] | null;
    }): Promise<{ details: PersonDetails | null }> => {
      if (!pid) return { details: null };
      const clientIdFor = (kind: string, body: unknown) => {
        const key = `${kind}:${JSON.stringify(body)}`;
        const hit = ids.current.find((x) => x.body === key);
        if (hit) return hit.id;
        const id = uuidV4();
        ids.current = [...ids.current.slice(-3), { body: key, id }];
        return id;
      };
      const api = getComunicaApi();
      let result: DetailsWriteResult | null = null;
      if (writes.details) {
        result = await api.updateProfileDetails(pid, {
          clientId: clientIdFor('details', writes.details),
          changes: writes.details,
        });
        // Lo releído por el servidor es lo que se pinta.
        qc.setQueryData(areaKey(profileKey('datos', pid)), result.details);
      }
      if (writes.health) {
        await api.updateProfileHealth(pid, {
          clientId: clientIdFor('health', writes.health),
          health: writes.health,
        });
        await qc.invalidateQueries({
          queryKey: areaKey(profileKey('salud', pid)),
        });
      }
      ids.current = [];
      return { details: result?.details ?? null };
    },
    [pid, qc],
  );
}

/** ¿Hay red? (el `onlineManager` que ya escucha la red del móvil). */
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true,
  );
}

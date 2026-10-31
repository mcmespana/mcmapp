// hooks/comunica/useMyProfiles.ts
//
// Quién ha entrado y sus hijos (`GET /v1/me/profiles`, plan 11). Se guarda
// en el móvil (los nombres de los propios hijos) y cambia poco. «¿A quién
// ves?» pide `fresh=1` al abrirse (es donde se mira «quiénes son los míos»):
// así aparece el hijo recién vinculado. Si el CRM no contesta, la consulta
// falla y se queda lo guardado: nunca una lista vacía inventada.

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getComunicaApi } from '@/services/comunica';
import type { MyProfiles } from '@/services/comunica/contract';
import { areaKey, STALE, useAreaQuery } from './useAreaQuery';

/** La clave, sin el prefijo `comunica` (lo pone `areaKey`). */
export const MY_PROFILES_KEY = ['perfiles'] as const;

export function useMyProfiles(enabled = true) {
  const qc = useQueryClient();
  const q = useAreaQuery({
    key: MY_PROFILES_KEY,
    route: 'myProfiles',
    fetch: () => getComunicaApi().getMyProfiles(),
    staleTime: STALE.structure,
    enabled,
  });
  /** Vuelve a preguntar sin la caché del servidor (`?fresh=1`). */
  const refreshFresh = useCallback(
    () =>
      qc
        .fetchQuery<MyProfiles>({
          queryKey: areaKey(MY_PROFILES_KEY),
          queryFn: () => getComunicaApi().getMyProfiles({ fresh: true }),
          staleTime: 0,
          meta: { persist: true },
        })
        .catch(() => undefined),
    [qc],
  );
  return { ...q, refreshFresh };
}

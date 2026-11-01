// «Mis datos» / «Datos de Lucía» (plan 12): la lectura y la escritura.
//
//   · Son datos personales y de salud: NADA en el móvil. `persist: false` en el contrato (`profileDetails`, `profileHealth`), memoria 5 min para
//     los datos y 1 min para la salud. El texto de salud vive en el estado de la pantalla y se va con ella.
//   · Sin cola: se escribe DIRECTO y con conexión, con un `clientId` por «Guardar» (el mismo en los reintentos del mismo guardado; así el servidor
//     no escribe dos veces). La cola del plan 01 guarda el cuerpo en disco y aquí no puede ir.
//   · Al guardar bien se pinta lo RELEÍDO que devuelve el servidor.

import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getComunicaApi } from '@/services/comunica';
import type {
  HealthInfo,
  PersonDetails,
  PersonDetailsChanges,
  ProfileHealth,
} from '@/services/comunica/contract';
import { isEmpty } from '@/utils/comunica/personDetails';
import { uuidV4 } from '@/utils/comunica/uuid';
import { areaKey, useAreaQuery } from './useAreaQuery';

const DETAILS_GC = 5 * 60_000;
const HEALTH_GC = 60_000;

export const detailsKey = (pid: string) => ['datos', pid] as const;
export const healthKey = (pid: string) => ['salud', pid] as const;

export function useProfileDetails(pid: string, enabled = true) {
  return useAreaQuery({
    key: [...detailsKey(pid)],
    route: 'profileDetails',
    fetch: () => getComunicaApi().getProfileDetails(pid),
    // Siempre se vuelve a pedir al entrar: son datos que cambia quien los edita en otro sitio.
    staleTime: 0,
    gcTime: DETAILS_GC,
    enabled,
  });
}

export function useProfileHealth(pid: string, enabled = true) {
  return useAreaQuery({
    key: [...healthKey(pid)],
    route: 'profileHealth',
    fetch: () => getComunicaApi().getProfileHealth(pid),
    staleTime: 0,
    gcTime: HEALTH_GC,
    enabled,
  });
}

export interface SaveInput {
  changes: PersonDetailsChanges;
  health: Partial<HealthInfo>;
  /** Lo confirmado de la salud, para pintar lo guardado sin volver a pedirlo. */
  confirmedHealth: HealthInfo | null;
}

/** Guarda lo que cambió: `PATCH` de los datos si hay algo y `PUT` de la salud si hay algo. Lanza el error de la primera que falle. */
export function useSaveProfile(pid: string) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  // Un `clientId` por «Guardar»: se conserva mientras falla y se suelta al salir bien.
  const ids = useRef<{ details?: string; health?: string }>({});

  const save = useCallback(
    async ({
      changes,
      health,
      confirmedHealth,
    }: SaveInput): Promise<{
      details?: PersonDetails;
      health?: HealthInfo;
    }> => {
      const out: { details?: PersonDetails; health?: HealthInfo } = {};
      setSaving(true);
      try {
        const api = getComunicaApi();
        if (!isEmpty(changes)) {
          ids.current.details ??= uuidV4();
          const r = await api.updateProfileDetails(pid, {
            clientId: ids.current.details,
            changes,
          });
          ids.current.details = undefined;
          qc.setQueryData<PersonDetails>(areaKey(detailsKey(pid)), r.details);
          out.details = r.details;
        }
        if (!isEmpty(health)) {
          ids.current.health ??= uuidV4();
          await api.updateProfileHealth(pid, {
            clientId: ids.current.health,
            health,
          });
          ids.current.health = undefined;
          if (confirmedHealth) {
            out.health = { ...confirmedHealth, ...health };
            qc.setQueryData<ProfileHealth>(areaKey(healthKey(pid)), {
              generatedAt: new Date().toISOString(),
              health: out.health,
            });
          }
        }
        return out;
      } finally {
        setSaving(false);
      }
    },
    [pid, qc],
  );
  return { save, saving };
}

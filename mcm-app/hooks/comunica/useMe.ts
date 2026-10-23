// La persona que ha entrado: papeles, alcance y si puede ver la salud. Toda
// pantalla decide qué enseña con esto, y ADEMÁS el servidor lo vuelve a
// comprobar: la app nunca es la barrera de seguridad.

import { getComunicaApi } from '@/services/comunica';
import { TEAM_ROLES } from '@/services/comunica/contract';
import { STALE, useAreaQuery } from './useAreaQuery';

export function useMe() {
  const q = useAreaQuery({
    key: ['me'],
    fetch: () => getComunicaApi().getMe(),
    staleTime: STALE.structure,
  });
  const me = q.data?.me ?? null;
  return {
    ...q,
    me,
    isTeam: !!me?.roles.some((r) => TEAM_ROLES.includes(r)),
    isCoordination: !!me?.roles.includes('coordination'),
  };
}

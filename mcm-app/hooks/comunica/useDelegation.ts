// hooks/comunica/useDelegation.ts
//
// El selector de la delegación de trabajo (plan 17): con qué delegaciones
// trabaja quien ha entrado, cuál es la de ahora y cambiarla. Solo hay selector
// con más de una; la elección se guarda en el cajón de la persona.

import { useEffect } from 'react';
import { useArea } from '@/components/comunica/comun/ComunicaAreaProvider';
import type { Delegation } from '@/services/comunica/contract';
import { setWorkingDelegation } from '@/services/comunica/delegation';
import { writeDrawer } from '@/services/comunica/storage';
import { useWorkingDelegation } from './useAreaQuery';
import { useMe } from './useMe';

export function useDelegation() {
  const personId = useArea().session.me?.personId ?? null;
  const { me } = useMe();
  const working = useWorkingDelegation();
  const home = me?.delegation ?? null;
  const team: Delegation[] = me?.teamDelegations?.length
    ? me.teamDelegations
    : home
      ? [home]
      : [];
  const current = working ?? home?.id ?? null;

  /** Elegir una; la de la ficha se guarda como «ninguna» (`null`). */
  const choose = (id: string) => {
    if (!team.some((d) => d.id === id)) return;
    const next = id === home?.id ? null : id;
    setWorkingDelegation(next);
    if (personId) void writeDrawer(personId, 'delegation', next ?? '');
  };

  // Una elegida que ya no es suya (se cerró la relación): a la de la ficha.
  const teamIds = team.map((d) => d.id).join(',');
  useEffect(() => {
    if (!me || !working || teamIds.split(',').includes(working)) return;
    setWorkingDelegation(null);
    if (personId) void writeDrawer(personId, 'delegation', '');
  }, [me, working, teamIds, personId]);

  return { team, current, choose, several: team.length > 1 };
}

/**
 * Un grupo de OTRA de tus delegaciones (un enlace, un aviso): se cambia el
 * selector a la suya (`sticpa_pl_follow_group_delegation`, plan 17, regla 6).
 */
export function useFollowGroupDelegation(delegationId: string | undefined) {
  const { current, choose, team } = useDelegation();
  const mine = !!delegationId && team.some((d) => d.id === delegationId);
  useEffect(() => {
    if (mine && delegationId && current && delegationId !== current) {
      choose(delegationId);
    }
    // `choose` cambia en cada render; manda el dato del grupo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, delegationId, current]);
}

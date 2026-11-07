// utils/comunica/team.ts
//
// «TU EQUIPO» en Coordinación (plan 06, regla 11; `sticpa_pl_directorio_monitores_html`
// del plugin), sin React: primero los monitores SIN GRUPO de verdad (con
// «Vincular», solo coordinación), luego APOYO (con su ficha a mano), después
// por etapa y, plegados al final, los de grupos que no pasan lista (plugin,
// 24/10/2026); el buscador (sin acentos ni mayúsculas, por nombre o por código
// de grupo) y anterior/siguiente en la ficha.

import type { Stage, TeamMember } from '@/services/comunica/contract';
import { STAGE_ORDER, stageTitle } from './monitorsRoll';

import { fold } from './search';

export { fold };

/** Sin grupo de verdad (vacío o comodín): lo que se vincula. */
export const isUnassigned = (
  m: Pick<TeamMember, 'groupCodes' | 'unassigned'>,
) => m.groupCodes.length === 0 && m.unassigned?.kind === 'none';

const unassignedKind = (m: Pick<TeamMember, 'groupCodes' | 'unassigned'>) =>
  m.groupCodes.length === 0 ? (m.unassigned?.kind ?? null) : null;

export interface TeamSection {
  stage: Stage | null;
  label: string;
  members: TeamMember[];
}

export interface TeamView {
  unassigned: TeamMember[];
  /** Apoyo, justo después de «Sin grupo», con enlace a su ficha. */
  support: TeamMember[];
  sections: TeamSection[];
  /** «Monitores de grupos que no pasan lista», plegados al final. */
  outside: TeamMember[];
  /** Con una sola etapa, sin cabeceras. */
  showHeaders: boolean;
}

/**
 * Sin grupo, Apoyo, por etapa y los de otros grupos al final, sin reordenar
 * lo del servidor.
 */
export function teamSections(team: readonly TeamMember[]): TeamView {
  const unassigned = team.filter(isUnassigned);
  const support = team.filter((m) => unassignedKind(m) === 'support');
  const outside = team.filter((m) => unassignedKind(m) === 'outside');
  const rest = team.filter((m) => unassignedKind(m) === null);
  const sections: TeamSection[] = [];
  for (const stage of STAGE_ORDER) {
    const members = rest.filter((m) => m.stage === stage);
    if (members.length) {
      sections.push({ stage, label: stageTitle(stage), members });
    }
  }
  return {
    unassigned,
    support,
    sections,
    outside,
    showHeaders: sections.length > 1,
  };
}

/** El orden en que se ven (para anterior/siguiente en la ficha). */
export const teamOrder = (team: readonly TeamMember[]): TeamMember[] => {
  const v = teamSections(team);
  return [
    ...v.unassigned,
    ...v.support,
    ...v.sections.flatMap((s) => s.members),
    ...v.outside,
  ];
};

/** «Buscar monitor o grupo…»: por nombre o por código, sin acentos. */
export function searchTeam(
  team: readonly TeamMember[],
  query: string,
): TeamMember[] {
  const q = fold(query.trim());
  if (!q) return [...team];
  return team.filter((m) => {
    const hay = fold(
      [
        `${m.firstName} ${m.lastName}`,
        ...m.groupCodes,
        m.unassigned?.outsideGroupName ?? '',
      ].join(' '),
    );
    return q.split(/\s+/).every((w) => hay.includes(w));
  });
}

/** Anterior y siguiente, sin dar la vuelta. */
export function neighborsOf<T extends { id: string }>(
  list: readonly T[],
  id: string,
): { prev: T | null; next: T | null } {
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return { prev: null, next: null };
  return {
    prev: i > 0 ? list[i - 1] : null,
    next: i < list.length - 1 ? list[i + 1] : null,
  };
}

/**
 * Lo que la cola ya ha vinculado y el servidor aún no ha dicho: el monitor
 * pasa a su etapa al momento (con su `UploadStatus`).
 */
export function withPendingAssignments(
  team: readonly TeamMember[],
  pending: ReadonlyMap<string, string>,
  groups: readonly {
    id: string;
    code: string | null;
    name: string;
    stage: Stage | null;
  }[],
): { team: TeamMember[]; pendingIds: Set<string> } {
  const pendingIds = new Set<string>();
  if (pending.size === 0) return { team: [...team], pendingIds };
  const out = team.map((m) => {
    const gid =
      m.unassigned?.kind === 'none'
        ? pending.get(m.unassigned.membershipId)
        : undefined;
    const g = gid ? groups.find((x) => x.id === gid) : undefined;
    if (!g) return m;
    pendingIds.add(m.id);
    return {
      ...m,
      groupCodes: [g.code ?? g.name],
      stage: g.stage,
      unassigned: undefined,
    };
  });
  return { team: out, pendingIds };
}

// utils/comunica/scope.ts
//
// El ALCANCE de quien coordina (plan 06, regla 1; `sticpa_pl_coord_scope`,
// `…_scope_matches` y `…_coord_scope_label` del plugin), sin React. Lo usan
// las pantallas de coordinación (la etiqueta) y el servidor falso (qué grupos
// entran).
//
//   · Sin etapa ni segmento = toda la delegación.
//   · Con varias relaciones de coordinación gana la MÁS AMPLIA; entre dos igual
//     de amplias, la primera (🔒 `alcance-coord`: así lo hace el plugin
//     mientras el propietario no diga otra cosa).
//   · Un grupo SIN segmento no entra en un alcance por segmento.
//   · Acompañar no da alcance; coordinar y acompañar no son jerárquicos.

import type { Me, Role, Segment, Stage } from '@/services/comunica/contract';

export type Scope = Me['scope'];

export const STAGE_TEXT: Record<Stage, string> = {
  mic: 'MIC',
  com: 'COM',
  lc: 'LC',
  apoyo: 'Apoyo',
};

/** El segmento tal cual, con `_` → espacio y en mayúsculas: «COM 2». */
export const segmentText = (s: Segment) => s.replace(/_/g, ' ').toUpperCase();

const parts = (scope: Scope) =>
  scope === 'delegation'
    ? { stages: [] as Stage[], segments: [] as Segment[] }
    : { stages: scope.stages ?? [], segments: scope.segments ?? [] };

/** ¿Está acotado (una etapa o un segmento) o es toda la delegación? */
export function isScoped(scope: Scope): boolean {
  const { stages, segments } = parts(scope);
  return stages.length > 0 || segments.length > 0;
}

/** «toda la delegación», «COM», «COM · COM 2», «COM 2». */
export function scopeLabel(scope: Scope): string {
  const { stages, segments } = parts(scope);
  if (!stages.length && !segments.length) return 'toda la delegación';
  const st = stages.map((s) => STAGE_TEXT[s]).join(', ');
  const sg = segments.map(segmentText).join(', ');
  if (st && sg) return `${st} · ${sg}`;
  return st || sg;
}

/** ¿Entra este grupo en el alcance? */
export function scopeMatches(
  scope: Scope,
  group: { stage: Stage | null; segment?: Segment | null },
): boolean {
  const { stages, segments } = parts(scope);
  if (stages.length && (!group.stage || !stages.includes(group.stage))) {
    return false;
  }
  if (segments.length) {
    // Sin segmento no se cuela: quien coordina COM 2 creería que es suyo.
    if (!group.segment || !segments.includes(group.segment)) return false;
  }
  return true;
}

/** Una relación de coordinación vigente: su etapa y el segmento de su grupo. */
export interface CoordRelation {
  stage?: Stage | null;
  segment?: Segment | null;
}

/**
 * El alcance de varias relaciones de coordinación: gana la más amplia (sin
 * etapa ni segmento = la delegación; sin segmento, a una con segmento). Entre
 * iguales, la primera. Sin relaciones, `null` (no coordina).
 */
export function broadestScope(
  relations: readonly CoordRelation[],
): Scope | null {
  let scope: CoordRelation | null = null;
  for (const c of relations) {
    if (!scope) scope = c;
    else if (!c.stage && !c.segment) scope = c;
    else if (scope.segment && !c.segment) scope = c;
  }
  if (!scope) return null;
  if (!scope.stage && !scope.segment) return 'delegation';
  return {
    ...(scope.stage ? { stages: [scope.stage] } : {}),
    ...(scope.segment ? { segments: [scope.segment] } : {}),
  };
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface CoordinationAccess {
  coordination: boolean;
  accompaniment: boolean;
  /** Puede entrar en «Coordinación» (y abrir fichas de monitores). */
  any: boolean;
}

export function coordinationAccess(
  roles: readonly Role[] | undefined,
): CoordinationAccess {
  const coordination = !!roles?.includes('coordination');
  const accompaniment = !!roles?.includes('accompaniment');
  return { coordination, accompaniment, any: coordination || accompaniment };
}

/**
 * El subtítulo de las pantallas de coordinación: el alcance si coordina
 * («Toda la delegación», «COM · COM 2»); si solo acompaña, su papel.
 */
export function coordinationSubtitle(me: Pick<Me, 'roles' | 'scope'>): string {
  return me.roles.includes('coordination')
    ? capitalize(scopeLabel(me.scope))
    : 'Acompañamiento';
}

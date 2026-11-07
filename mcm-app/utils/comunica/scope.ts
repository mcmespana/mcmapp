// utils/comunica/scope.ts
//
// El ALCANCE de quien coordina o acompaña (plan 06, regla 1; `sticpa_pl_coord_scope`,
// `…_scope_matches` y `…_coord_scope_label` del plugin), sin React. Lo usan
// las pantallas de coordinación (la etiqueta) y el servidor falso (qué grupos
// entran).
//
//   · Sin etapa ni segmento = toda la delegación.
//   · ✅ `alcance-coord` (21/10): con varias relaciones se ve LA SUMA, y
//     acompañamiento igual que coordinación (los monitores sin grupo, para
//     quien ve toda la delegación). El plugin se quedaba con la primera.
//   · Un grupo SIN segmento no entra en un alcance por segmento.
//
// Cómo se lee `Me.scope` con listas: cada etapa de `stages` entra entera,
// salvo que `segments` traiga segmentos de esa etapa (los `com_*` son del
// COM): entonces solo esos. Un segmento cuya etapa no está en `stages`
// también entra. Así `{ stages: ['mic', 'com'], segments: ['com_2'] }` es
// «MIC entero y COM 2», la suma de una relación de MIC y otra de COM 2.

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

/** La etapa de un segmento (hoy todos son del COM). */
export const segmentStage = (_s: Segment): Stage => 'com';

const parts = (scope: Scope) =>
  scope === 'delegation'
    ? { stages: [] as Stage[], segments: [] as Segment[] }
    : { stages: scope.stages ?? [], segments: scope.segments ?? [] };

/** ¿Está acotado (una etapa o un segmento) o es toda la delegación? */
export function isScoped(scope: Scope): boolean {
  const { stages, segments } = parts(scope);
  return stages.length > 0 || segments.length > 0;
}

/** «toda la delegación», «COM», «COM · COM 2», «COM 2», «MIC, COM · COM 2». */
export function scopeLabel(scope: Scope): string {
  const { stages, segments } = parts(scope);
  if (!stages.length && !segments.length) return 'toda la delegación';
  const out: string[] = [];
  for (const st of stages) {
    const segs = segments.filter((g) => segmentStage(g) === st);
    out.push(
      segs.length
        ? `${STAGE_TEXT[st]} · ${segs.map(segmentText).join(', ')}`
        : STAGE_TEXT[st],
    );
  }
  const loose = segments.filter((g) => !stages.includes(segmentStage(g)));
  if (loose.length) out.push(loose.map(segmentText).join(', '));
  return out.join(', ');
}

/** ¿Entra este grupo en el alcance? */
export function scopeMatches(
  scope: Scope,
  group: { stage: Stage | null; segment?: Segment | null },
): boolean {
  if (!isScoped(scope)) return true;
  const { stages, segments } = parts(scope);
  if (!group.stage) return false;
  const segsOfStage = segments.filter((g) => segmentStage(g) === group.stage);
  if (segsOfStage.length) {
    // Sin segmento no se cuela: quien coordina COM 2 creería que es suyo.
    return !!group.segment && segsOfStage.includes(group.segment);
  }
  return stages.includes(group.stage);
}

/** Una relación vigente de coordinación o acompañamiento: etapa y segmento de su grupo. */
export interface CoordRelation {
  stage?: Stage | null;
  segment?: Segment | null;
}

/**
 * El alcance de varias relaciones: LA SUMA. Una sin etapa ni segmento es toda
 * la delegación; una etapa entera se come los segmentos de esa etapa. Sin
 * relaciones, `null` (ni coordina ni acompaña).
 */
export function unionScope(relations: readonly CoordRelation[]): Scope | null {
  if (relations.length === 0) return null;
  if (relations.some((r) => !r.stage && !r.segment)) return 'delegation';
  const whole = new Set<Stage>();
  const segments = new Set<Segment>();
  for (const r of relations) {
    if (r.segment) segments.add(r.segment);
    else if (r.stage) whole.add(r.stage);
  }
  const keptSegments = [...segments].filter((g) => !whole.has(segmentStage(g)));
  const stages = new Set<Stage>(whole);
  for (const r of relations) {
    if (r.segment && r.stage && !whole.has(r.stage)) stages.add(r.stage);
  }
  const order: Stage[] = ['mic', 'com', 'lc', 'apoyo'];
  return {
    ...(stages.size ? { stages: order.filter((s) => stages.has(s)) } : {}),
    ...(keptSegments.length ? { segments: keptSegments.sort() } : {}),
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
 * («Toda la delegación», «COM · COM 2»); si solo acompaña, su papel (es lo
 * que explica que vea esto, `design.md` del plugin §6.4).
 */
export function coordinationSubtitle(me: Pick<Me, 'roles' | 'scope'>): string {
  return me.roles.includes('coordination')
    ? capitalize(scopeLabel(me.scope))
    : 'Acompañamiento';
}

// utils/comunica/monitorsRoll.ts
//
// La lista de MONITORES (plan 06, reglas 2-6; `single_stic_pasar_lista_monitores.php`
// y `sticpa_pl_next_state_monitor` del plugin), sin React. Es la pantalla de
// marcar del plan 04 en modo `monitors`, con dos diferencias a propósito:
//
//   1. ARRANCA TODO EN VERDE: se asume que los monitores vienen. No hay «sin
//      marcar»; el toque pone y quita faltas.
//   2. Al guardar se manda `yes` EXPLÍCITO para cada fila: aquí el verde es un
//      dato afirmado, no un hueco (si no, el % de quien viene a todo saldría 0).
//
// El borrador es el mismo `RollDraft` del plan 04 (y su `useRollDraft`).

import type {
  Mark,
  MonitorsRoll,
  MonitorsRollWrite,
  SetMark,
  Stage,
  TeamMember,
} from '@/services/comunica/contract';
import { NOTE_MAX } from '@/services/comunica/contract';
import { isAbsence, isAttendance, MARK_NOTE } from './marks';
import type { RollDraft } from './rollDraft';
import { STAGE_TEXT } from './scope';

type Rows = MonitorsRoll['rows'];

/** De dónde parte: lo guardado y, si no hay nada, «vino». */
export function monitorsDraftFrom(rows: Rows): RollDraft {
  const marks: RollDraft['marks'] = {};
  const notes: RollDraft['notes'] = {};
  for (const r of rows) {
    marks[r.member.id] = r.mark ?? 'yes';
    notes[r.member.id] = r.mark && r.mark !== 'yes' ? (r.reason ?? '') : '';
  }
  return { marks, notes };
}

/** El toque: «No vino» ⇄ «Vino»; desde Parcial o Justificada, a «No vino». */
export function nextMonitorMarkOnTap(current: Mark): SetMark {
  return current === 'no_unjustified' ? 'yes' : 'no_unjustified';
}

/**
 * Poner una marca. «Quitar la marca» (`null`) vuelve a verde, y volver a
 * «Vino» se lleva el motivo.
 */
export function setMonitorMark(
  draft: RollDraft,
  id: string,
  mark: Mark,
): RollDraft {
  const m: SetMark = mark ?? 'yes';
  return {
    marks: { ...draft.marks, [id]: m },
    notes: { ...draft.notes, [id]: m === 'yes' ? '' : (draft.notes[id] ?? '') },
  };
}

/** La marca efectiva de una fila (nunca `null`). */
export const effectiveMark = (draft: RollDraft, id: string): SetMark =>
  draft.marks[id] ?? 'yes';

/**
 * Lo que va en el PUT: UNA por fila, ninguna `null`, el motivo recortado a
 * 255 y fuera si vino.
 */
export function monitorsMarks(
  rows: Rows,
  draft: RollDraft,
): MonitorsRollWrite['marks'] {
  return rows.map((r) => {
    const mark = effectiveMark(draft, r.member.id);
    const reason =
      mark === 'yes'
        ? ''
        : (draft.notes[r.member.id] ?? '').trim().slice(0, NOTE_MAX);
    return {
      personId: r.member.id,
      mark,
      ...(reason ? { reason } : {}),
    };
  });
}

/** «N vinieron · N faltas»: Parcial cuenta como vino. */
export function monitorsCounts(
  rows: Rows,
  draft: RollDraft,
): { came: number; missed: number } {
  let came = 0;
  let missed = 0;
  for (const r of rows) {
    const m = effectiveMark(draft, r.member.id);
    if (isAttendance(m)) came += 1;
    else if (isAbsence(m)) missed += 1;
  }
  return { came, missed };
}

export function isMonitorsDirty(rows: Rows, draft: RollDraft): boolean {
  const base = monitorsDraftFrom(rows);
  return rows.some(
    (r) =>
      effectiveMark(draft, r.member.id) !== base.marks[r.member.id] ||
      (draft.notes[r.member.id] ?? '').trim() !==
        (base.notes[r.member.id] ?? '').trim(),
  );
}

/** Ya pasada e igual: nada que guardar. Sin pasar, sí (todo verde es un dato). */
export function monitorsCanSave(
  roll: Pick<MonitorsRoll, 'rows' | 'rollCall'>,
  draft: RollDraft,
): boolean {
  if (roll.rows.length === 0) return false;
  if (roll.rollCall?.status === 'taken' && !isMonitorsDirty(roll.rows, draft))
    return false;
  return true;
}

export const cameText = (n: number) => (n === 1 ? '1 vino' : `${n} vinieron`);
export const absencesText = (n: number) =>
  n === 1 ? '1 falta' : `${n} faltas`;

/** «Esta lista de monitores ya está pasada: N vinieron, N faltas…». */
export function alreadyTakenText(counts: { came: number; missed: number }) {
  return `Esta lista de monitores ya está pasada: ${counts.came} vinieron, ${counts.missed} faltas. Si la cambias, se actualiza.`;
}

/**
 * La nota bajo el nombre: lo matizado (Parcial, Justificada), el aviso y el
 * motivo, en una línea. Roja si hay aviso.
 */
export function monitorNote(
  mark: SetMark,
  reason: string,
  alert: string | null,
): { text: string | null; danger: boolean } {
  const bits = [
    MARK_NOTE[mark],
    alert ?? undefined,
    mark !== 'yes' && reason.trim() ? reason.trim() : undefined,
  ].filter(Boolean) as string[];
  return { text: bits.length ? bits.join(' · ') : null, danger: !!alert };
}

/** La línea fija de un monitor: «C1 · C2 · 2 ESO», o «Sin grupo asignado». */
export function memberLine(
  m: Pick<TeamMember, 'groupCodes' | 'schoolLevel' | 'unassigned'>,
  { outside = false } = {},
): string {
  if (m.groupCodes.length === 0) {
    return outside && m.unassigned?.outsideGroupName
      ? `${m.unassigned.outsideGroupName} · no entra en Pasar Lista`
      : 'Sin grupo asignado';
  }
  return [...m.groupCodes, m.schoolLevel?.label].filter(Boolean).join(' · ');
}

export const STAGE_ORDER: readonly (Stage | null)[] = [
  'mic',
  'com',
  'lc',
  'apoyo',
  null,
];

export const stageTitle = (s: Stage | null) =>
  s ? STAGE_TEXT[s] : 'Sin etapa';

export interface MonitorSection<R> {
  key: string;
  stage: Stage | null;
  label: string;
  /** Filas PROPIAS (una sección solo de prestados dice «0 monitores»). */
  count: number;
  /** «También lleva grupo de esta etapa: …», o nada. */
  borrowedNote: string | null;
  rows: R[];
}

export const monitorsCountText = (n: number) =>
  n === 1 ? '1 monitor' : `${n} monitores`;

/**
 * Por etapa (MIC, COM, LC, «Sin etapa»), sin reordenar lo que manda el
 * servidor. Un monitor de dos etapas sale UNA vez (en la de su curso más
 * bajo, `stage`) y la otra sección lo nombra, aunque no tenga filas propias.
 */
export function monitorSections<R extends { member: TeamMember }>(
  rows: readonly R[],
  borrowed: readonly TeamMember[] = [],
): MonitorSection<R>[] {
  const all = [...rows.map((r) => r.member), ...borrowed];
  const out: MonitorSection<R>[] = [];
  for (const stage of STAGE_ORDER) {
    const own = rows.filter((r) => r.member.stage === stage);
    const seen = new Set<string>();
    const lent = stage
      ? all.filter((m) => {
          if (m.stage === stage || !m.otherStages.includes(stage)) return false;
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        })
      : [];
    if (own.length === 0 && lent.length === 0) continue;
    const names = lent.map(
      (m) =>
        `${m.firstName} ${m.lastName}${m.stage ? ` (${STAGE_TEXT[m.stage]})` : ''}`,
    );
    out.push({
      key: stage ?? 'none',
      stage,
      label: stageTitle(stage),
      count: own.length,
      borrowedNote: names.length
        ? names.length === 1
          ? `También lleva grupo de esta etapa: ${names[0]}. Sale una sola vez, en su otra sección.`
          : `También llevan grupo de esta etapa: ${names.join(', ')}. Salen una sola vez, en su otra sección.`
        : null,
      rows: own,
    });
  }
  return out;
}

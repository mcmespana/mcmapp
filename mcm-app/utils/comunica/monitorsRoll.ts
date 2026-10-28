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
// Salvo las filas `optional` (plugin, 25/10/2026): quien no va por grupos de
// Pasar Lista (Apoyo, otros grupos, sin grupo) arranca SIN MARCAR, el toque
// cicla «-» → vino → no vino → «-», sin marca no se manda ni cuenta, y no
// lleva % ni aviso. Van al final: Apoyo desplegado, los demás plegados.
//
// El borrador es el mismo `RollDraft` del plan 04 (y su `useRollDraft`).

import type {
  Mark,
  MonitorsRoll,
  MonitorsRollWrite,
  SessionSummary,
  SetMark,
  Stage,
  TeamMember,
} from '@/services/comunica/contract';
import { NOTE_MAX } from '@/services/comunica/contract';
import { isAbsence, isAttendance, MARK_NOTE } from './marks';
import type { RollDraft } from './rollDraft';
import { STAGE_TEXT } from './scope';
import { isFutureSession } from './sessions';

type Rows = MonitorsRoll['rows'];

/**
 * ¿Se puede marcar esta sesión? (✅ `futuras` = «como el plugin»): hoy y lo
 * pasado, sí; una reunión, también si es futura; en la semanal, de las futuras
 * solo la próxima cuando aún no ha empezado ninguna (es la que propone la
 * regla del plan 04).
 */
export function canMarkSession(
  kind: MonitorsRoll['kind'],
  session: Pick<SessionSummary, 'id' | 'date' | 'startsAt'>,
  sessions: readonly Pick<SessionSummary, 'id' | 'date' | 'startsAt'>[],
  now: Date,
): boolean {
  if (kind === 'meeting' || !isFutureSession(session, now)) return true;
  const sorted = [...sessions].sort((a, b) =>
    a.startsAt < b.startsAt ? -1 : 1,
  );
  const anyStarted = sorted.some(
    (s) => new Date(s.startsAt).getTime() <= now.getTime(),
  );
  return !anyStarted && sorted[0]?.id === session.id;
}

type RowLike = Pick<Rows[number], 'optional'> & {
  member: Pick<TeamMember, 'id'>;
};

/** El verde de partida: «vino», salvo en una fila opcional («-»). */
const defaultMark = (row: Pick<RowLike, 'optional'>): Mark =>
  row.optional ? null : 'yes';

/** De dónde parte: lo guardado y, si no hay nada, su verde de partida. */
export function monitorsDraftFrom(rows: Rows): RollDraft {
  const marks: RollDraft['marks'] = {};
  const notes: RollDraft['notes'] = {};
  for (const r of rows) {
    marks[r.member.id] = r.mark ?? defaultMark(r);
    notes[r.member.id] = r.mark && r.mark !== 'yes' ? (r.reason ?? '') : '';
  }
  return { marks, notes };
}

/**
 * El toque: «No vino» ⇄ «Vino»; desde Parcial o Justificada, a «No vino». En
 * una fila opcional: «-» → «Vino» → «No vino» → «-».
 */
export function nextMonitorMarkOnTap(current: Mark, optional = false): Mark {
  if (optional) {
    if (current === null) return 'yes';
    return current === 'yes' ? 'no_unjustified' : null;
  }
  return current === 'no_unjustified' ? 'yes' : 'no_unjustified';
}

/**
 * Poner una marca. «Quitar la marca» (`null`) vuelve al verde de partida
 * («-» en una fila opcional), y volver a «Vino» se lleva el motivo.
 */
export function setMonitorMark(
  draft: RollDraft,
  id: string,
  mark: Mark,
  optional = false,
): RollDraft {
  const m: Mark = mark ?? (optional ? null : 'yes');
  return {
    marks: { ...draft.marks, [id]: m },
    notes: {
      ...draft.notes,
      [id]: m === 'yes' || m === null ? '' : (draft.notes[id] ?? ''),
    },
  };
}

/** La marca efectiva de una fila: `null` solo en una opcional sin marcar. */
export const effectiveMark = (
  draft: RollDraft,
  id: string,
  optional = false,
): Mark =>
  id in draft.marks ? (draft.marks[id] ?? null) : optional ? null : 'yes';

/**
 * Lo que va en el PUT: UNA por fila, ninguna `null` (las opcionales sin
 * marcar no van), el motivo recortado a 255 y fuera si vino.
 */
export function monitorsMarks(
  rows: Rows,
  draft: RollDraft,
): MonitorsRollWrite['marks'] {
  return rows.flatMap((r) => {
    const mark = effectiveMark(draft, r.member.id, r.optional);
    if (mark === null) return [];
    const reason =
      mark === 'yes'
        ? ''
        : (draft.notes[r.member.id] ?? '').trim().slice(0, NOTE_MAX);
    return [
      {
        personId: r.member.id,
        mark,
        ...(reason ? { reason } : {}),
      },
    ];
  });
}

/** «N vinieron · N faltas»: Parcial cuenta como vino; sin marcar, nada. */
export function monitorsCounts(
  rows: Rows,
  draft: RollDraft,
): { came: number; missed: number } {
  let came = 0;
  let missed = 0;
  for (const r of rows) {
    const m = effectiveMark(draft, r.member.id, r.optional);
    if (isAttendance(m)) came += 1;
    else if (isAbsence(m)) missed += 1;
  }
  return { came, missed };
}

export function isMonitorsDirty(rows: Rows, draft: RollDraft): boolean {
  const base = monitorsDraftFrom(rows);
  return rows.some(
    (r) =>
      effectiveMark(draft, r.member.id, r.optional) !==
        (base.marks[r.member.id] ?? null) ||
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
  mark: Mark,
  reason: string,
  alert: string | null,
): { text: string | null; danger: boolean } {
  const bits = [
    mark ? MARK_NOTE[mark] : undefined,
    alert ?? undefined,
    mark && mark !== 'yes' && reason.trim() ? reason.trim() : undefined,
  ].filter(Boolean) as string[];
  return { text: bits.length ? bits.join(' · ') : null, danger: !!alert };
}

/**
 * La línea fija de un monitor: «C1 · C2 · 2 ESO»; sin grupo de Pasar Lista,
 * el nombre del grupo que lleva («Monitores Apoyo», «Najar») o «Sin grupo
 * asignado».
 */
export function memberLine(
  m: Pick<TeamMember, 'groupCodes' | 'schoolLevel' | 'unassigned'>,
): string {
  if (m.groupCodes.length === 0) {
    return m.unassigned?.kind !== 'none' && m.unassigned?.outsideGroupName
      ? m.unassigned.outsideGroupName
      : 'Sin grupo asignado';
  }
  return [...m.groupCodes, m.schoolLevel?.label].filter(Boolean).join(' · ');
}

/** «No se les pasa lista: salen con «-». Toca solo si han venido.» */
export const OPTIONAL_HINT =
  'No se les pasa lista: salen con «-». Toca solo si han venido.';

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
  /** Las filas opcionales: con su pista; «Otros monitores» va plegada. */
  optional?: 'support' | 'others';
}

export const monitorsCountText = (n: number) =>
  n === 1 ? '1 monitor' : `${n} monitores`;

/**
 * Por etapa (MIC, COM, LC, «Sin etapa»), sin reordenar lo que manda el
 * servidor. Un monitor de dos etapas sale UNA vez (en la de su curso más
 * bajo, `stage`) y la otra sección lo nombra, aunque no tenga filas propias.
 */
export function monitorSections<
  R extends { member: TeamMember; optional?: boolean },
>(
  rows: readonly R[],
  borrowed: readonly TeamMember[] = [],
): MonitorSection<R>[] {
  const all = [...rows.map((r) => r.member), ...borrowed];
  const out: MonitorSection<R>[] = [];
  const optional = rows.filter((r) => r.optional);
  const regular = rows.filter((r) => !r.optional);
  for (const stage of STAGE_ORDER) {
    const own = regular.filter((r) => r.member.stage === stage);
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
  // Al final, sin reordenar (el servidor ya los manda de joven a mayor):
  // Apoyo desplegado y los demás plegados.
  const support = optional.filter(
    (r) => r.member.unassigned?.kind === 'support',
  );
  const others = optional.filter(
    (r) => r.member.unassigned?.kind !== 'support',
  );
  if (support.length) {
    out.push({
      key: 'support',
      stage: null,
      label: 'Apoyo',
      count: support.length,
      borrowedNote: null,
      rows: support,
      optional: 'support',
    });
  }
  if (others.length) {
    out.push({
      key: 'others',
      stage: null,
      label: 'Otros monitores',
      count: others.length,
      borrowedNote: null,
      rows: others,
      optional: 'others',
    });
  }
  return out;
}

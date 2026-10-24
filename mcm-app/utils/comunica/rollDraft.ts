// utils/comunica/rollDraft.ts
//
// El borrador de una lista mientras se marca, sin React: de dónde parte, qué
// ha cambiado y qué se manda al guardar (plan 04).

import type {
  Mark,
  RollDetail,
  RollWrite,
  SetMark,
} from '@/services/comunica/contract';
import { NOTE_MAX } from '@/services/comunica/contract';

export interface RollDraft {
  marks: Record<string, Mark>;
  notes: Record<string, string>;
}

export function draftFrom(roll: RollDetail): RollDraft {
  const marks: Record<string, Mark> = {};
  const notes: Record<string, string> = {};
  for (const e of roll.entries) {
    marks[e.person.id] = e.mark;
    notes[e.person.id] = e.note;
  }
  return { marks, notes };
}

export function isDirty(roll: RollDetail, draft: RollDraft): boolean {
  return roll.entries.some(
    (e) =>
      (draft.marks[e.person.id] ?? null) !== e.mark ||
      (draft.notes[e.person.id] ?? '') !== e.note,
  );
}

/** «Han venido todos»: los que están sin marcar pasan a «Vino». */
export function markAllUnmarked(draft: RollDraft): RollDraft {
  const marks = { ...draft.marks };
  for (const [id, m] of Object.entries(marks))
    if (m === null) marks[id] = 'yes';
  return { ...draft, marks };
}

/** Lo que va en el PUT: las marcas puestas y sus motivos (≤ 255). */
export function toRollWrite(draft: RollDraft, clientId: string): RollWrite {
  const marks: Record<string, SetMark> = {};
  const notes: Record<string, string> = {};
  for (const [id, m] of Object.entries(draft.marks)) {
    if (!m) continue;
    marks[id] = m;
    // Va aunque esté vacío: vaciar un motivo es deliberado y se escribe.
    notes[id] = (draft.notes[id] ?? '').trim().slice(0, NOTE_MAX);
  }
  return { clientId, action: 'save', marks, notes };
}

/**
 * La lista como quedará al subir (actualización optimista, plan 01 §4): lo
 * marcado se ve ya en la pantalla y en la portada, antes de que conteste el
 * servidor. Cuando contesta, se cambia por lo que de verdad quedó.
 */
export function applyDraft(
  roll: RollDetail,
  draft: RollDraft,
  action: 'save' | 'skip',
  takenAt: string,
): RollDetail {
  if (action === 'skip') {
    return {
      ...roll,
      roll: {
        sessionId: roll.session.id,
        groupId: roll.groupId,
        status: 'skipped',
        takenAt,
        counts: { came: 0, missed: 0 },
      },
    };
  }
  const entries = roll.entries.map((e) => ({
    ...e,
    mark: draft.marks[e.person.id] ?? e.mark,
    note: (draft.notes[e.person.id] ?? e.note).trim().slice(0, NOTE_MAX),
  }));
  const marks = entries.map((e) => e.mark);
  return {
    ...roll,
    entries,
    roll: {
      sessionId: roll.session.id,
      groupId: roll.groupId,
      status: 'taken',
      takenAt: roll.roll?.takenAt ?? takenAt,
      counts: {
        came: marks.filter((m) => m === 'yes' || m === 'partial').length,
        missed: marks.filter(
          (m) => m === 'no_justified' || m === 'no_unjustified',
        ).length,
      },
    },
  };
}

/** ¿Hay algo que guardar? Sin marcas, no; con la lista pasada e igual, tampoco. */
export function hasSomethingToSave(
  roll: RollDetail,
  draft: RollDraft,
): boolean {
  if (!Object.values(draft.marks).some((m) => m)) return false;
  if (roll.roll?.status === 'taken' && !isDirty(roll, draft)) return false;
  return true;
}

/**
 * El botón de «todos»: sin ninguna marca, «Han venido todos»; con alguna, «El
 * resto ha venido (N)». Solo rellena lo sin marcar. Sin nadie por marcar, nada.
 */
export function fillRestLabel(draft: RollDraft): string | null {
  const marks = Object.values(draft.marks);
  const unmarked = marks.filter((m) => !m).length;
  if (unmarked === 0) return null;
  return unmarked === marks.length
    ? 'Han venido todos'
    : `El resto ha venido (${unmarked})`;
}

/**
 * Lo que no ha quedado guardado (`sticpa_pl_check_saved`): lo que vuelve en
 * `notSaved` y cualquier marca mandada que, releída, no está igual.
 */
export function checkSaved(
  sent: Pick<RollWrite, 'marks'>,
  reread: RollDetail,
  notSaved: readonly { personId: string }[],
): string[] {
  const missing = new Set(notSaved.map((n) => n.personId));
  const now = new Map(reread.entries.map((e) => [e.person.id, e.mark]));
  for (const [id, mark] of Object.entries(sent.marks)) {
    if (now.get(id) !== mark) missing.add(id);
  }
  return [...missing];
}

/** El borrador que queda tras guardar: solo lo que no entró. */
export function draftAfterSave(
  draft: RollDraft,
  missing: readonly string[],
): RollDraft | null {
  if (missing.length === 0) return null;
  const keep = new Set(missing);
  const marks: RollDraft['marks'] = {};
  const notes: RollDraft['notes'] = {};
  for (const id of Object.keys(draft.marks)) {
    if (keep.has(id)) {
      marks[id] = draft.marks[id];
      notes[id] = draft.notes[id] ?? '';
    }
  }
  return { marks, notes };
}

/** «Te faltan…»: con más de `max`, se enseñan `max - 1` y «Y N más». */
export function pendingDisplay<T>(items: readonly T[], max = 4) {
  if (items.length <= max) return { shown: [...items], more: 0 };
  return { shown: items.slice(0, max - 1), more: items.length - (max - 1) };
}

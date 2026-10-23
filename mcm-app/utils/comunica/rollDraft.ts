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

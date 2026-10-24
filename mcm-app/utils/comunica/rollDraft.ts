// utils/comunica/rollDraft.ts
//
// El borrador de una lista mientras se marca, sin React: de dónde parte, qué
// ha cambiado y qué se manda al guardar (plan 04).

import type { Mark, RollDetail, RollWrite } from '@/services/comunica/contract';
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

/**
 * Lo que va en el PUT: las marcas puestas y sus motivos (≤ 255) y, con
 * `mark: null`, a quien tenía una marca guardada y se le ha quitado
 * (`desmarcar` = la asistencia se borra también en el CRM, 21/10). `saved` es
 * la lista tal y como está en la caché (lo guardado o lo encolado antes).
 */
export function toRollWrite(
  draft: RollDraft,
  clientId: string,
  saved: RollDetail,
): RollWrite {
  const marks: Record<string, Mark> = {};
  const notes: Record<string, string> = {};
  for (const [id, m] of Object.entries(draft.marks)) {
    if (!m) continue;
    marks[id] = m;
    // Va aunque esté vacío: vaciar un motivo es deliberado y se escribe.
    notes[id] = normalizeNote(draft.notes[id]);
  }
  for (const id of clearedIds(saved, draft)) marks[id] = null;
  return { clientId, action: 'save', marks, notes };
}

const normalizeNote = (note: string | undefined) =>
  (note ?? '').trim().slice(0, NOTE_MAX);

/** Quien tenía marca guardada y en el borrador ya no la tiene. */
function clearedIds(saved: RollDetail, draft: RollDraft): string[] {
  return saved.entries
    .filter(
      (e) =>
        e.mark !== null &&
        e.person.id in draft.marks &&
        draft.marks[e.person.id] === null,
    )
    .map((e) => e.person.id);
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
  // Una marca quitada (`null` en el borrador) se queda quitada.
  const entries = roll.entries.map((e) => {
    const id = e.person.id;
    const mark = id in draft.marks ? (draft.marks[id] ?? null) : e.mark;
    return {
      ...e,
      mark,
      note: mark ? normalizeNote(draft.notes[id] ?? e.note) : '',
    };
  });
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

/**
 * ¿No hay nada que escribir? Sin ninguna marca y sin quitar ninguna guardada.
 * Es el «No has marcado a nadie»: dejar a cero una lista ya pasada sí se
 * guarda (`desmarcar`).
 */
export function isEmptyWrite(roll: RollDetail, draft: RollDraft): boolean {
  return (
    !Object.values(draft.marks).some((m) => m) &&
    clearedIds(roll, draft).length === 0
  );
}

/** ¿Hay algo que guardar? Sin marcas, no; con la lista pasada e igual, tampoco. */
export function hasSomethingToSave(
  roll: RollDetail,
  draft: RollDraft,
): boolean {
  if (isEmptyWrite(roll, draft)) return false;
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
    // Una marca quitada vale si ya no está (o si la persona ya no sale).
    if ((now.get(id) ?? null) !== mark) missing.add(id);
  }
  return [...missing];
}

/**
 * El borrador cuando la subida se aplica: lo releído (`fresh`), salvo
 *   · lo que no ha quedado guardado (`missing`), que sigue como estaba, y
 *   · lo tocado DESPUÉS de encolar: lo que en el borrador actual ya no es lo
 *     que se mandó (se siguió marcando mientras subía, o se salió con
 *     «Guardar» y la cola subió una versión anterior).
 */
export function draftAfterApplied(
  fresh: RollDraft,
  sent: Pick<RollWrite, 'marks' | 'notes'>,
  current: RollDraft,
  missing: readonly string[],
): RollDraft {
  const keep = new Set(missing);
  for (const id of Object.keys(current.marks)) {
    const now = current.marks[id] ?? null;
    const was = sent.marks[id] ?? null;
    if (now !== was) keep.add(id);
    else if (now && normalizeNote(current.notes[id]) !== (sent.notes[id] ?? ''))
      keep.add(id);
  }
  const marks = { ...fresh.marks };
  const notes = { ...fresh.notes };
  for (const id of keep) {
    if (!(id in current.marks)) continue;
    marks[id] = current.marks[id] ?? null;
    notes[id] = current.notes[id] ?? '';
  }
  return { marks, notes };
}

/** «Te faltan…»: con más de `max`, se enseñan `max - 1` y «Y N más». */
export function pendingDisplay<T>(items: readonly T[], max = 4) {
  if (items.length <= max) return { shown: [...items], more: 0 };
  return { shown: items.slice(0, max - 1), more: items.length - (max - 1) };
}

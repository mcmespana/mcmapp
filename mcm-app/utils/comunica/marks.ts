// utils/comunica/marks.ts
//
// Las reglas de las marcas de asistencia y de cómo se nombra un grupo, sin
// React (`PASAR-LISTA.md` §6 del plugin). Las usan `MarkControl`, la pantalla
// de marcar (plan 04) y los recuentos.

import type { Mark, SetMark } from '@/services/comunica/contract';

export const MARK_LABEL: Record<SetMark, string> = {
  yes: 'Vino',
  partial: 'Parcial',
  no_justified: 'Justificada',
  no_unjustified: 'No vino',
};

/** Icono SF Symbol de cada marca (`IconSymbol` lo traduce en Android y web). */
export const MARK_ICON = {
  yes: 'checkmark',
  partial: 'circle.lefthalf.filled',
  no_justified: 'minus',
  no_unjustified: 'xmark',
} as const satisfies Record<SetMark, string>;

/** Orden en el que se ofrecen (y se leyenda): las dos de asistencia primero. */
export const MARK_ORDER: readonly SetMark[] = [
  'yes',
  'partial',
  'no_justified',
  'no_unjustified',
];

/** Vino y Parcial son asistencia; las otras dos, ausencia (también en la racha). */
export const isAttendance = (m: Mark): boolean =>
  m === 'yes' || m === 'partial';
export const isAbsence = (m: Mark): boolean =>
  m === 'no_justified' || m === 'no_unjustified';

/**
 * El gesto principal: tocar la fila (`sticpa_pl_next_state`). Sin marcar →
 * Vino → No vino → sin marcar. Desde Parcial o Justificada, a Vino: lo
 * matizado se pone con la pulsación larga.
 */
export function nextMarkOnTap(current: Mark): Mark {
  if (current === null) return 'yes';
  if (current === 'yes') return 'no_unjustified';
  if (current === 'no_unjustified') return null;
  return 'yes';
}

/** Lo que dice la marca bajo el nombre (las dos «normales» no dicen nada). */
export const MARK_NOTE: Partial<Record<SetMark, string>> = {
  partial: 'Parcial',
  no_justified: 'Justificada',
};

/** Lo que explica la hoja de cada estado. */
export const MARK_HELP: Record<SetMark, string> = {
  yes: 'Ha venido',
  partial: 'Cuenta como asistencia',
  no_justified: 'No es necesario justificar, pero a veces avisan',
  no_unjustified: 'No ha venido',
};

export interface MarkCounts {
  came: number;
  missed: number;
  unmarked: number;
}

export function countMarks(marks: readonly Mark[]): MarkCounts {
  return marks.reduce<MarkCounts>(
    (acc, m) => {
      if (isAttendance(m)) acc.came += 1;
      else if (isAbsence(m)) acc.missed += 1;
      else acc.unmarked += 1;
      return acc;
    },
    { came: 0, missed: 0, unmarked: 0 },
  );
}

/**
 * Racha de faltas seguidas, contando desde la más reciente. `marks` va de la
 * última a la primera, como `previousMarks`. Un «sin marcar» corta la racha.
 */
export function absenceStreak(marks: readonly Mark[]): number {
  let n = 0;
  for (const m of marks) {
    if (!isAbsence(m)) break;
    n += 1;
  }
  return n;
}

/**
 * Cómo se nombra un grupo en pantalla (`PASAR-LISTA.md` §6.2): el código
 * primero; el nombre, solo si añade algo. Nunca «C1 · C1».
 */
export function groupTitle(g: { code: string | null; name: string }): {
  code: string | null;
  name: string | null;
} {
  const code = g.code?.trim() || null;
  const name = g.name.trim();
  if (!code) return { code: null, name };
  if (!name || name.toLowerCase() === code.toLowerCase()) {
    return { code, name: null };
  }
  return { code, name };
}

/** «C1 · Los Peques», en texto plano (accesibilidad, listas cortas). */
export function groupLabel(g: { code: string | null; name: string }): string {
  const t = groupTitle(g);
  return [t.code, t.name].filter(Boolean).join(' · ');
}

/** «3 ausencias seguidas». */
export const streakLabel = (n: number) =>
  n === 1 ? '1 ausencia' : `${n} ausencias seguidas`;

/** Plurales de los recuentos de la barra. */
export const cameLabel = (n: number) => (n === 1 ? '1 vino' : `${n} vinieron`);
export const missedLabel = (n: number) =>
  n === 1 ? '1 ausencia' : `${n} ausencias`;
export const unmarkedLabel = (n: number) => `${n} sin marcar`;

/** «12 chavalines» (decisión del propietario para los recuentos). */
export const participantsLabel = (n: number): string =>
  n === 1 ? '1 chavalín' : `${n} chavalines`;

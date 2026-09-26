import type { DayRecord } from '@/contexts/ContigoHabitsContext';
import { offsetISODate } from '@/utils/localDate';

export type ContigoHabit = 'reading' | 'prayer' | 'revision';

function isDone(record: DayRecord | undefined, habit: ContigoHabit): boolean {
  if (!record) return false;
  if (habit === 'reading') return !!record.readingDone;
  if (habit === 'prayer') return !!record.prayerDone;
  return !!record.revisionDone;
}

/**
 * Días seguidos con el hábito hecho, contando hacia atrás desde `today`.
 *
 * Hoy sin hacer NO rompe la racha (todavía hay tiempo): se cuenta desde ayer.
 * Es la misma regla que enseña la pantalla de Contigo, y la usan también los
 * widgets — por eso vive aquí y no dentro del contexto, para que no haya dos
 * cálculos que se separen.
 */
export function computeStreak(
  records: Record<string, DayRecord>,
  habit: ContigoHabit,
  today: string,
): number {
  let streak = 0;
  let cursor = today;
  // Tope de seguridad: un mapa corrupto no puede colgar la app. Diez años de
  // racha dan para bastante.
  for (let i = 0; i < 3660; i++) {
    const done = isDone(records[cursor], habit);
    if (done) streak++;
    else if (cursor !== today) break;
    cursor = offsetISODate(cursor, -1);
  }
  return streak;
}

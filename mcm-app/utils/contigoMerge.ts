import type { DayRecord } from '@/hooks/useContigoHabits';

/** Cuenta cuántos de los 3 hábitos booleanos están marcados en un registro. */
function markedCount(record: DayRecord): number {
  return (
    (record.readingDone ? 1 : 0) +
    (record.prayerDone ? 1 : 0) +
    (record.revisionDone ? 1 : 0)
  );
}

/**
 * Fusiona los hábitos diarios locales con los descargados de RTDB.
 *
 * Por fecha, gana el registro con más hábitos marcados; a igualdad, el
 * local. Así un remoto desactualizado nunca "desmarca" progreso local
 * reciente. `datesToResync` son las fechas donde lo local aportó algo que el
 * remoto no tenía (o tenía menos completo) — hay que volver a subirlas.
 */
export function mergeContigoHabits(
  local: Record<string, DayRecord>,
  remote: Record<string, DayRecord>,
): { merged: Record<string, DayRecord>; datesToResync: string[] } {
  const merged: Record<string, DayRecord> = {};
  const datesToResync: string[] = [];
  const allDates = new Set([...Object.keys(local), ...Object.keys(remote)]);

  for (const date of allDates) {
    const localRecord = local[date];
    const remoteRecord = remote[date];

    if (!remoteRecord) {
      merged[date] = localRecord;
      datesToResync.push(date);
      continue;
    }
    if (!localRecord) {
      merged[date] = remoteRecord;
      continue;
    }
    if (markedCount(localRecord) >= markedCount(remoteRecord)) {
      merged[date] = localRecord;
      if (markedCount(localRecord) > markedCount(remoteRecord)) {
        datesToResync.push(date);
      }
    } else {
      merged[date] = remoteRecord;
    }
  }

  return { merged, datesToResync };
}

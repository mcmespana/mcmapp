import { logger } from '@/utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Prefijo de la caché local de lecturas diarias (`hooks/useDailyReadings.ts`).
 *  Vive aquí — no en el hook — para que solo haya una copia del literal. */
export const DAILY_READINGS_PREFIX = '@daily_readings_';

const KEY_RE = /^@daily_readings_(\d{4}-\d{2}-\d{2})$/;

/** Qué claves borrar: solo las que casan EXACTAMENTE con el patrón
 *  prefijo+fecha ISO y cuya fecha es anterior a `todayISO − retentionDays`.
 *  Cualquier otra clave (de otro dominio, o con el prefijo pero sin fecha
 *  válida) se ignora — salvo que la "fecha" mal formada compare como más
 *  vieja que hoy por orden lexicográfico, en cuyo caso es basura y se poda
 *  igual (p. ej. `@daily_readings_2026-13-99`). */
export function selectKeysToPrune(
  allKeys: readonly string[],
  todayISO: string,
  retentionDays = 60,
): string[] {
  const cutoff = new Date(todayISO + 'T00:00:00Z');
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  const cutoffISO = cutoff.toISOString().slice(0, 10);

  return allKeys.filter((key) => {
    const match = key.match(KEY_RE);
    if (!match) return false;
    return match[1] < cutoffISO;
  });
}

/** IO: getAllKeys → selectKeysToPrune → multiRemove. Se traga errores con
 *  `logger.warn` — la poda nunca debe romper la carga de lecturas del día. */
export async function pruneDailyReadingsCache(
  todayISO: string = new Date().toISOString().slice(0, 10),
): Promise<number> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const toPrune = selectKeysToPrune(allKeys, todayISO);
    if (toPrune.length === 0) return 0;
    await AsyncStorage.multiRemove(toPrune);
    return toPrune.length;
  } catch (err) {
    logger.warn('[dailyReadingsCache] fallo podando la caché', err);
    return 0;
  }
}

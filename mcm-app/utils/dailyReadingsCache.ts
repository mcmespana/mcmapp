/**
 * Poda de la caché de lecturas diarias.
 *
 * `useDailyReadings` cachea cada día bajo su propia clave
 * (`@daily_readings_YYYY-MM-DD`: evangelio + comentario + dos lecturas + salmo,
 * 5-15 KB por día) y **nada la podaba jamás**. Un usuario diario acumula una
 * clave por día sin tope — en un año, varios MB que la app nunca reclama,
 * degradando el SQLite de AsyncStorage en Android sin remedio salvo reinstalar.
 * Y el nodo remoto se purga a 30 días (limpieza del scraper), así que una copia
 * local vieja no solo sobra: puede servir lecturas que el scraper corrigió
 * después.
 *
 * La poda **no puede perder datos del usuario**: los guardados llevan su propia
 * copia del texto en `@contigo_bookmarks` (`StoredBookmark.readings`), y el hook
 * la usa como fallback. El único riesgo sería un prefijo codicioso, y para eso
 * está el regex exacto de abajo — con un test centinela sobre
 * `@contigo_bookmarks`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/utils/logger';

export const DAILY_READINGS_PREFIX = '@daily_readings_';

/** Solo prefijo + fecha ISO exacta. Cualquier otra clave se ignora. */
const KEY_RE = /^@daily_readings_(\d{4}-\d{2}-\d{2})$/;

/**
 * Retención por defecto. Sesenta días cubren de sobra el selector de fechas (el
 * nodo remoto solo guarda 30) con margen. Si algún día el selector ofrece
 * histórico largo, hay que subir esto ANTES de ampliarlo.
 */
export const DEFAULT_RETENTION_DAYS = 60;

/** `YYYY-MM-DD` de hace `days` días respecto a `todayISO`, en UTC puro. */
function isoMinusDays(todayISO: string, days: number): string {
  const [y, m, d] = todayISO.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - days));
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

/**
 * Pura: qué claves hay que borrar. Solo las que casan EXACTAMENTE con
 * prefijo + fecha ISO y cuya fecha es anterior a la ventana de retención.
 * La comparación es lexicográfica, que en `YYYY-MM-DD` coincide con la
 * cronológica (y manda a la basura las fechas inventadas tipo `2026-13-99`
 * solo si quedan por detrás del corte, que es lo correcto para basura).
 */
export function selectKeysToPrune(
  allKeys: readonly string[],
  todayISO: string,
  retentionDays: number = DEFAULT_RETENTION_DAYS,
): string[] {
  const cutoff = isoMinusDays(todayISO, retentionDays);
  return allKeys.filter((key) => {
    const match = KEY_RE.exec(key);
    return match ? match[1] < cutoff : false;
  });
}

/**
 * IO: mira todas las claves, decide y borra. Nunca lanza — la poda es un extra
 * y jamás debe romper la carga de las lecturas.
 *
 * Devuelve cuántas claves se borraron.
 */
export async function pruneDailyReadingsCache(
  todayISO: string,
  retentionDays: number = DEFAULT_RETENTION_DAYS,
): Promise<number> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const toPrune = selectKeysToPrune(allKeys, todayISO, retentionDays);
    if (toPrune.length === 0) return 0;
    await AsyncStorage.multiRemove(toPrune);
    logger.info(
      `[lecturas] podadas ${toPrune.length} entradas de caché anteriores a ${retentionDays} días`,
    );
    return toPrune.length;
  } catch (err) {
    logger.warn('[lecturas] no se pudo podar la caché', err);
    return 0;
  }
}

/**
 * Lógica pura de la pantalla de oración (`app/(tabs)/contigo/oracion.tsx`).
 */
import type {
  DayRecord,
  PrayerDuration,
} from '@/contexts/ContigoHabitsContext';

/** Tope inferior y superior del paso a paso de «Personalizado». */
export const PRAYER_MIN_MINUTES = 1;
export const PRAYER_MAX_MINUTES = 120;
/** Cada pulsación del paso a paso salta de cinco en cinco. */
export const PRAYER_STEP_MINUTES = 5;
/** Con nada guardado todavía, el paso a paso arranca aquí. */
export const PRAYER_DEFAULT_MINUTES = 15;

/**
 * Siguiente valor del paso a paso: múltiplos de cinco, con los topes en 1 y
 * 120. Desde un valor suelto (13 de una pastilla) salta al múltiplo más
 * cercano en esa dirección: 13 → 15 al subir, 13 → 10 al bajar. Si ya está en
 * un tope devuelve el mismo número, y quien llama lo usa para avisar con la
 * háptica de tope.
 */
export function stepPrayerMinutes(current: number, direction: 1 | -1): number {
  const step = PRAYER_STEP_MINUTES;
  if (direction === 1) {
    return Math.min(
      PRAYER_MAX_MINUTES,
      (Math.floor(current / step) + 1) * step,
    );
  }
  return Math.max(PRAYER_MIN_MINUTES, (Math.ceil(current / step) - 1) * step);
}

/**
 * La duración de la última oración apuntada (la del día más reciente con
 * oración y minutos), o `null` si todavía no hay ninguna. El paso a paso
 * arranca ahí en vez de en un 15 fijo: quien reza siempre veinte minutos no
 * tiene que subir desde quince cada vez.
 */
export function lastPrayerMinutes(
  records: Record<string, DayRecord>,
): number | null {
  let bestDate = '';
  let minutes: number | null = null;
  for (const [date, rec] of Object.entries(records)) {
    if (!rec?.prayerDone || !rec.prayerDurationMinutes) continue;
    if (date > bestDate) {
      bestDate = date;
      minutes = rec.prayerDurationMinutes;
    }
  }
  return minutes;
}

/**
 * El enum que se guarda junto a los minutos exactos, casado con las etiquetas
 * de las pastillas: «< 2 min» → `less_than_1`, «2–5» → `2_to_4`, «5–10» →
 * `5_to_10`, «10–15» → `10_to_15` y «+15» → `more_than_15`. Antes «< 2 min» se
 * guardaba como `2_to_4` porque la comparación era `< 1`, que no se cumple
 * nunca (el mínimo son 1 minuto).
 */
export function prayerDurationEnum(minutes: number): PrayerDuration {
  if (minutes < 2) return 'less_than_1';
  if (minutes <= 4) return '2_to_4';
  if (minutes <= 10) return '5_to_10';
  if (minutes <= 15) return '10_to_15';
  return 'more_than_15';
}

/**
 * Lado de cada celda del calendario «Tu mes»: siete celdas y seis huecos de 5
 * dentro de una tarjeta de `maxContentWidth` como mucho, con 16 de margen de
 * pantalla y 20 de relleno de tarjeta por cada lado. Se calcula con el ancho de
 * ventana ACTUAL: medido una vez al cargar el módulo, un Split View de iPad o
 * una ventana de escritorio que cambia de tamaño dejaban las celdas pequeñas
 * o, peor, demasiado anchas para caber siete por fila.
 */
export function prayerCalendarCellSize(
  windowWidth: number,
  maxContentWidth: number,
): number {
  const SIDE_CHROME = 72; // 2 × (16 de pantalla + 20 de tarjeta)
  const GAPS = 30; // 6 huecos de 5
  return Math.floor(
    (Math.min(windowWidth, maxContentWidth) - SIDE_CHROME - GAPS) / 7,
  );
}

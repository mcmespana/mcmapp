// utils/comunica/recordDates.ts
//
// Las fechas de una ficha de registro (plan 13), como el plugin
// (`sticpa_record_date_line`, `inc/stic-record-view.php` 90-108): siempre con
// el año, porque en una ficha uno mira «cuándo» y el año importa (un
// campamento de julio que se apunta en enero).
//
//   · un día:          «5 de mayo de 2026»
//   · mismo mes:       «del 1 al 10 de julio de 2026»
//   · meses distintos: «del 28 de septiembre de 2026 al 2 de octubre de 2026»
//
// La duración, «3 días», solo si es una duración (de 2 a 31): «Sesiones
// semanales» de septiembre a junio no es una actividad de 231 días.

import { MONTHS } from './dates';
import { daysBetween } from './madrid';

/** Por encima de esto el número es ruido (`sticpa_event_max_dias_duracion`). */
export const MAX_DURATION_DAYS = 31;

const parts = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return { y, m, d };
};

/** «5 de mayo de 2026». */
export function dayInWords(day: string): string {
  const { y, m, d } = parts(day);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

/** La línea de fechas de una tarjeta o ficha. `''` sin inicio. */
export function dateLine(
  start: string | null | undefined,
  end?: string | null,
): string {
  if (!start) return '';
  if (!end || end === start || end < start) return dayInWords(start);
  if (start.slice(0, 7) === end.slice(0, 7)) {
    return `del ${parts(start).d} al ${dayInWords(end)}`;
  }
  return `del ${dayInWords(start)} al ${dayInWords(end)}`;
}

/** Días que dura, contando los dos extremos (1-10 de julio son 10). */
export function durationDays(
  start: string | null | undefined,
  end: string | null | undefined,
): number | null {
  if (!start || !end || end < start) return null;
  return daysBetween(start, end) + 1;
}

/** «3 días», o `null` si no es una duración que contar (1 día, o más de 31). */
export function durationLabel(
  start: string | null | undefined,
  end: string | null | undefined,
): string | null {
  const n = durationDays(start, end);
  return n !== null && n > 1 && n <= MAX_DURATION_DAYS ? `${n} días` : null;
}

/** «35 €» o «35,50 €» (nunca «35.00»). */
export function priceLabel(price: number): string {
  const whole = Number.isInteger(price);
  return `${whole ? String(price) : price.toFixed(2).replace('.', ',')} €`;
}

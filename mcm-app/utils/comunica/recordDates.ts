// utils/comunica/recordDates.ts
//
// Fechas de una ficha de registro en palabras (plan 13, `inc/stic-events.php`): «5 de mayo de 2026», «del 1 al 10 de julio de 2026», «del 28 de
// septiembre de 2026 al 2 de octubre de 2026». Y la duración, solo de 2 a 31 días. Siempre sobre días de Madrid; nunca «05/05/2026».

import { fullDay } from './dates';
import { daysBetween } from './madrid';

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const parts = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return { y, m, day };
};

/** Las fechas de un evento. Sin inicio, `null`; sin fin (o igual al inicio, o anterior), de un día. */
export function dateRangeText(
  start: string | null,
  end: string | null,
): string | null {
  if (!start) return end ? fullDay(end) : null;
  if (!end || end <= start) return fullDay(start);
  const a = parts(start);
  const b = parts(end);
  if (a.y === b.y && a.m === b.m)
    return `del ${a.day} al ${b.day} de ${MONTHS[a.m - 1]} de ${a.y}`;
  return `del ${fullDay(start)} al ${fullDay(end)}`;
}

/** «3 días»: solo de 2 a 31 (más es un campamento largo o un dato mal puesto; un día no es una duración). */
export function durationText(
  start: string | null,
  end: string | null,
): string | null {
  if (!start || !end) return null;
  const days = daysBetween(start, end) + 1;
  return days >= 2 && days <= 31 ? `${days} días` : null;
}

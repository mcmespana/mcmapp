// utils/comunica/madrid.ts
//
// Días y horas de Madrid sin depender de la zona del móvil ni de `Intl` (que en
// Hermes viejo no trae zonas). El área privada vive en hora de Madrid: un
// «sábado a las 16:30» es de Madrid aunque el móvil esté en Canarias o en
// Roma. Puro y sin React: lo usan el servidor falso y las reglas de Pasar Lista.
//
// Regla de la UE: horario de verano desde el último domingo de marzo a las
// 01:00 UTC hasta el último domingo de octubre a las 01:00 UTC.

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** Último domingo de un mes (0-11) a las 01:00 UTC, en ms. */
function lastSundayAt1Utc(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  const back = lastDay.getUTCDay(); // 0 = domingo
  return Date.UTC(year, month, lastDay.getUTCDate() - back, 1);
}

/** Desfase de Madrid respecto a UTC en ese instante, en horas (1 o 2). */
export function madridOffsetHours(at: Date): 1 | 2 {
  const y = at.getUTCFullYear();
  const t = at.getTime();
  return t >= lastSundayAt1Utc(y, 2) && t < lastSundayAt1Utc(y, 9) ? 2 : 1;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` del día de Madrid en ese instante. */
export function madridDay(at: Date): string {
  const local = new Date(at.getTime() + madridOffsetHours(at) * HOUR_MS);
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
}

/** Instante de un día y hora de Madrid. `time` = `HH:MM`. */
export function madridDate(day: string, time = '00:00'): Date {
  const [y, m, d] = day.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  // Se prueba con +1 y se corrige: el cambio de hora es de madrugada, así que
  // a cualquier hora de actividad el desfase del día ya es el bueno.
  const guess = Date.UTC(y, m - 1, d, hh - 1, mm);
  const offset = madridOffsetHours(new Date(guess));
  return new Date(Date.UTC(y, m - 1, d, hh - offset, mm));
}

/** ISO con zona: `2026-10-24T16:30:00+02:00`. */
export function madridInstant(day: string, time = '00:00'): string {
  const at = madridDate(day, time);
  return `${day}T${time}:00+0${madridOffsetHours(at)}:00`;
}

/** Suma días a un `YYYY-MM-DD` (sin zonas: aritmética de calendario). */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + days * DAY_MS);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Días de calendario de `from` a `to` (positivo si `to` es posterior). */
export function daysBetween(from: string, to: string): number {
  const ms = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((ms(to) - ms(from)) / DAY_MS);
}

/** Día de la semana de un `YYYY-MM-DD`: 0 = domingo … 6 = sábado. */
export function weekday(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Hora de Madrid `HH:MM` de un instante ISO. */
export function madridTime(iso: string): string {
  const at = new Date(iso);
  const local = new Date(at.getTime() + madridOffsetHours(at) * HOUR_MS);
  return `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

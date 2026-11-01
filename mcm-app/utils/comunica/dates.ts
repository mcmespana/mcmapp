// utils/comunica/dates.ts
//
// Fechas en lenguaje humano para el área (`design.md` del plugin: «sábado 25
// de octubre», nunca «25/10/2026»). Siempre sobre días de Madrid.

import { daysBetween, weekday } from './madrid';

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
const WEEKDAYS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3).toUpperCase());

const parts = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return { y, m, d };
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** «sábado 25 de octubre». Con `capital`, «Sábado 25 de octubre». */
export function longDay(day: string, capital = false): string {
  const { m, d } = parts(day);
  const s = `${WEEKDAYS[weekday(day)]} ${d} de ${MONTHS[m - 1]}`;
  return capital ? capitalize(s) : s;
}

/** «5 de mayo de 2014» (una fecha de nacimiento o de expedición). */
export function fullDay(day: string): string {
  const { y, m, d } = parts(day);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

/** «sáb 25». */
export function shortDay(day: string): string {
  return `${WEEKDAYS[weekday(day)].slice(0, 3)} ${parts(day).d}`;
}

/** «sáb 15 nov» (el `D j M` del plugin). */
export function shortDayMonth(day: string): string {
  const { m, d } = parts(day);
  return `${WEEKDAYS[weekday(day)].slice(0, 3)} ${d} ${MONTHS[m - 1].slice(0, 3)}`;
}

/** Día y mes de la cápsula: `{ day: '25', month: 'OCT' }`. */
export function capsule(day: string): { day: string; month: string } {
  const { m, d } = parts(day);
  return { day: String(d), month: MONTHS_SHORT[m - 1] };
}

/** «Hoy», «Ayer», «Hace 6 días», «Mañana», «Dentro de 3 días». */
export function relativeDay(day: string, today: string): string {
  const n = daysBetween(today, day);
  if (n === 0) return 'Hoy';
  if (n === -1) return 'Ayer';
  if (n === 1) return 'Mañana';
  return n < 0 ? `Hace ${-n} días` : `Dentro de ${n} días`;
}

/** «hace un momento», «hace 5 min», «hace 2 h», «hace 3 días». */
export function ago(fromIso: string, now: Date): string {
  const ms = now.getTime() - new Date(fromIso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'hace 1 día' : `hace ${d} días`;
}

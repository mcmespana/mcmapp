/**
 * Cuándo se destaca «Tu año en Contigo». El resto del año es un enlace
 * discreto al final de Contigo; en estas fechas sube con una tarjeta animada:
 *
 *  - Adviento: la semana de antes y las dos primeras semanas.
 *  - Navidad y comienzo de año: la última semana de Adviento hasta el día 21
 *    de enero (las tres primeras semanas del año).
 *
 * La animación se apaga en cuanto se ha entrado a «Tu año» tres veces en esa
 * temporada (`RECAP_SEASON_OPENS`).
 */

export const RECAP_SEASON_OPENS = 3;
const DAY = 86_400_000;

const atNoon = (y: number, m: number, d: number) => new Date(y, m, d, 12);

/** Primer domingo de Adviento: el cuarto domingo antes de Navidad. */
export function firstSundayOfAdvent(year: number): Date {
  const christmas = atNoon(year, 11, 25);
  // Domingo estrictamente anterior a Navidad (si cae en domingo, el de antes).
  const back = christmas.getDay() === 0 ? 7 : christmas.getDay();
  return new Date(christmas.getTime() - (back + 21) * DAY);
}

export interface RecapSeason {
  /** Clave de la temporada (para contar las visitas). */
  id: string;
  /** Año que se resume. */
  year: number;
}

/** La temporada destacada en la que cae `date`, o null. */
export function recapSeason(date: Date): RecapSeason | null {
  const y = date.getFullYear();
  const t = atNoon(y, date.getMonth(), date.getDate()).getTime();
  // Enero: hasta el 21, resume el año que acaba de terminar.
  if (t < atNoon(y, 0, 22).getTime()) {
    return { id: `navidad-${y - 1}`, year: y - 1 };
  }
  const advent = firstSundayOfAdvent(y).getTime();
  if (t >= advent - 7 * DAY && t < advent + 14 * DAY) {
    return { id: `adviento-${y}`, year: y };
  }
  if (t >= advent + 21 * DAY) {
    return { id: `navidad-${y}`, year: y };
  }
  return null;
}

/** Año que abre «Tu año» por defecto: en enero, el que acaba de terminar. */
export function defaultRecapYear(date: Date): number {
  return recapSeason(date)?.year ?? date.getFullYear();
}

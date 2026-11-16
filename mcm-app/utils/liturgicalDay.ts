/**
 * El día litúrgico: tiempo, fiesta, número de domingo, ciclo A/B/C y color.
 *
 * Lógica PURA sobre `assets/calendario-liturgico.json` (empaquetado: no hay
 * red). La usan Contigo (el badge de la fecha) y «Cantos para el domingo»
 * (`utils/sundaySongs.ts`), para que no digan dos cosas distintas del mismo
 * día. Ver `docs/funcionalidades/CANTOS_DOMINGO.md`.
 *
 * Lo que el JSON NO trae y se calcula aquí:
 *  - el número de domingo (II del Tiempo Ordinario, IV de Pascua…);
 *  - el ciclo A/B/C: el campo `ciclo_dominical` va por año CIVIL y está mal
 *    desde el 1.er domingo de Adviento (el año litúrgico ya es el siguiente).
 */
import liturgicalCalendar from '@/assets/calendario-liturgico.json';
import { LiturgicalColors } from '@/constants/colors';

export type SeasonId =
  'adviento' | 'navidad' | 'cuaresma' | 'semana_santa' | 'pascua' | 'ordinario';

export type LiturgicalCycle = 'A' | 'B' | 'C';

/** Color de chip de HeroUI para el badge de Contigo. */
export type ChipColor = 'accent' | 'default' | 'success' | 'warning' | 'danger';

export interface LiturgicalDay {
  /** `YYYY-MM-DD`. */
  fecha: string;
  season: SeasonId;
  /** Id de `fechas_especiales` (`cristo_rey`, `todos_los_santos`…) si hoy es una. */
  feastId?: string;
  /** Número de domingo del tiempo (34 = XXXIV del T. Ordinario). */
  sundayNumber?: number;
  /** Ciclo del leccionario, calculado por año litúrgico. */
  cycle: LiturgicalCycle;
  /** «XXXIV Domingo del Tiempo Ordinario»; sin domingo, la fiesta o el tiempo. */
  name: string;
  /** «Jesucristo, Rey del Universo» cuando el día es una fiesta. */
  feastName?: string;
  /** Color litúrgico. */
  colorHex: string;
}

interface CalendarYear {
  pascua: string;
  tiempos: { id: string; nombre: string; inicio: string; fin: string }[];
  fechas_especiales?: { id: string; fecha: string; nombre: string }[];
  domingos_adviento?: string[];
  domingos_cuaresma?: string[];
}

const calendar = liturgicalCalendar as unknown as Record<string, CalendarYear>;

// ── Fechas (UTC, sin husos ni horario de verano) ────────────────────────────

const DAY_MS = 86_400_000;

function toUtcDay(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1) / DAY_MS;
}

function fromUtcDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** Suma días a un `YYYY-MM-DD`. */
export function addDays(dateStr: string, days: number): string {
  return fromUtcDay(toUtcDay(dateStr) + days);
}

/** 0 = domingo … 6 = sábado. */
export function weekdayOf(dateStr: string): number {
  return (toUtcDay(dateStr) + 4) % 7; // 1970-01-01 fue jueves (4)
}

/** `YYYY-MM-DD` con la fecha LOCAL del aparato (no la UTC). */
export function isoDateLocal(date: Date = new Date()): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Domingo → el mismo día; lunes-sábado → el domingo siguiente. */
export function targetSunday(hoy: string): string {
  const wd = weekdayOf(hoy);
  return wd === 0 ? hoy : addDays(hoy, 7 - wd);
}

/** `YYYY-MM-DD` es una fecha real (la ruta llega como texto). */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  return fromUtcDay(toUtcDay(value)) === value;
}

/** Semanas completas desde el 1 de enero: número de semana estable por fecha. */
export function weekIndexOf(dateStr: string): number {
  return Math.floor(toUtcDay(dateStr) / 7);
}

// ── Ciclo ───────────────────────────────────────────────────────────────────

/** 1.er domingo de Adviento: el domingo desde el 27 de nov (27 nov-3 dic). */
function firstAdventSunday(year: number): string {
  const nov27 = `${year}-11-27`;
  const wd = weekdayOf(nov27);
  return addDays(nov27, wd === 0 ? 0 : 7 - wd);
}

/**
 * Ciclo A/B/C por año litúrgico. El año que EMPIEZA en el 1.er domingo de
 * Adviento de Y y acaba en Y + 1 es el de `(Y + 1) % 3` (1 → A, 2 → B, 0 → C),
 * la misma regla del generador pero contando desde Adviento y no desde el 1 de
 * enero: 2026-11-22 → A, 2026-11-29 → B.
 */
export function cycleOf(fecha: string): LiturgicalCycle {
  const year = Number(fecha.slice(0, 4));
  const startYear = fecha >= firstAdventSunday(year) ? year : year - 1;
  const r = (startYear + 1) % 3;
  return r === 1 ? 'A' : r === 2 ? 'B' : 'C';
}

// ── Nombres ─────────────────────────────────────────────────────────────────

const ROMAN: [number, string][] = [
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

export function toRoman(n: number): string {
  let rest = n;
  let out = '';
  for (const [value, symbol] of ROMAN) {
    while (rest >= value) {
      out += symbol;
      rest -= value;
    }
  }
  return out;
}

/** Nombre largo de las fiestas cuyo nombre del calendario es corto. */
const FEAST_LONG_NAMES: Record<string, string> = {
  cristo_rey: 'Jesucristo, Rey del Universo',
};

const SEASON_SUNDAY_LABEL: Record<SeasonId, string> = {
  adviento: 'Domingo de Adviento',
  navidad: 'Domingo de Navidad',
  cuaresma: 'Domingo de Cuaresma',
  semana_santa: 'Domingo de Semana Santa',
  pascua: 'Domingo de Pascua',
  ordinario: 'Domingo del Tiempo Ordinario',
};

// ── Color y tiempo (lo que ya pintaba el badge de Contigo) ─────────────────

export interface LiturgicalInfo {
  color: ChipColor;
  name: string;
  hex: string;
}

/** Fiestas rojas (mártires, Espíritu Santo, Pasión). El resto, blanco. */
function isRedFeast(id: string): boolean {
  return (
    id === 'pentecostes' ||
    id === 'exaltacion_cruz' ||
    id === 'san_pedro_san_pablo' ||
    id.includes('ramos') ||
    id.includes('viernes_santo') ||
    id.includes('apostol')
  );
}

const ORDINARY_FALLBACK: LiturgicalInfo = {
  color: 'success',
  name: 'Tiempo Ordinario',
  hex: LiturgicalColors.green,
};

/**
 * Nombre y color litúrgico de una fecha, tal y como los enseña el badge de
 * Contigo (`components/contigo/LiturgicalBadge.tsx`, que lo reexporta). Una
 * fecha fuera de la ventana del calendario cae en «Tiempo Ordinario».
 */
export function getLiturgicalInfo(dateStr: string): LiturgicalInfo {
  const calYear = calendar[dateStr.split('-')[0]];
  if (!calYear) return ORDINARY_FALLBACK;

  const special = calYear.fechas_especiales?.find((d) => d.fecha === dateStr);
  if (special) {
    let color: ChipColor = 'default';
    let hex: string = LiturgicalColors.white;
    if (isRedFeast(special.id)) {
      color = 'danger';
      hex = LiturgicalColors.red;
    } else if (special.id === 'miercoles_ceniza') {
      color = 'accent';
      hex = LiturgicalColors.purple;
    }
    return { color, name: special.nombre, hex };
  }

  // Gaudete / Laetare
  const gaudete = calYear.domingos_adviento?.[2] === dateStr;
  if (gaudete || calYear.domingos_cuaresma?.[3] === dateStr) {
    return {
      color: 'warning',
      name: gaudete ? 'Adviento (Gaudete)' : 'Cuaresma (Laetare)',
      hex: LiturgicalColors.rose,
    };
  }

  for (const tiempo of calYear.tiempos) {
    if (dateStr >= tiempo.inicio && dateStr <= tiempo.fin) {
      let color: ChipColor = 'success';
      let hex: string = LiturgicalColors.green;
      if (tiempo.id === 'adviento' || tiempo.id === 'cuaresma') {
        color = 'accent';
        hex = LiturgicalColors.purple;
      } else if (tiempo.id === 'navidad' || tiempo.id === 'pascua') {
        // 'warning' (dorado) se lee bien en claro y oscuro; 'default' lleva
        // texto oscuro y se pierde en fondo oscuro.
        color = 'warning';
        hex = LiturgicalColors.gold;
      } else if (tiempo.id === 'semana_santa') {
        color = 'danger';
        hex = LiturgicalColors.red;
      }
      return { color, name: tiempo.nombre, hex };
    }
  }
  return ORDINARY_FALLBACK;
}

// ── El día completo ─────────────────────────────────────────────────────────

function seasonOf(calYear: CalendarYear | undefined, fecha: string): SeasonId {
  const tiempo = calYear?.tiempos.find(
    (t) => fecha >= t.inicio && fecha <= t.fin,
  );
  return (tiempo?.id as SeasonId | undefined) ?? 'ordinario';
}

/** Número de domingo del tiempo, o `undefined` si no es domingo / no aplica. */
function sundayNumberOf(
  calYear: CalendarYear | undefined,
  season: SeasonId,
  fecha: string,
): number | undefined {
  if (!calYear || weekdayOf(fecha) !== 0) return undefined;

  if (season === 'adviento') {
    const i = calYear.domingos_adviento?.indexOf(fecha) ?? -1;
    return i >= 0 ? i + 1 : undefined;
  }
  if (season === 'cuaresma') {
    const i = calYear.domingos_cuaresma?.indexOf(fecha) ?? -1;
    return i >= 0 ? i + 1 : undefined;
  }
  if (season === 'pascua') {
    // Pascua = domingo I; Pentecostés (VIII) sale como fiesta.
    const n = (toUtcDay(fecha) - toUtcDay(calYear.pascua)) / 7 + 1;
    return n >= 2 && n <= 7 ? n : undefined;
  }
  if (season === 'ordinario') {
    const specials = calYear.fechas_especiales ?? [];
    if (fecha < calYear.pascua) {
      // Tramo 1: cuenta desde el Bautismo del Señor (que es el domingo I; si
      // cae en lunes, el I es el domingo anterior, la Epifanía).
      const bautismo = specials.find((d) => d.id === 'bautismo_del_senor');
      if (!bautismo) return undefined;
      const wd = weekdayOf(bautismo.fecha);
      const baseSunday =
        wd === 0 ? bautismo.fecha : addDays(bautismo.fecha, -wd);
      const n = (toUtcDay(fecha) - toUtcDay(baseSunday)) / 7 + 1;
      return n >= 2 ? n : undefined;
    }
    // Tramo 2: hacia atrás desde Cristo Rey = XXXIV.
    const rey = specials.find((d) => d.id === 'cristo_rey');
    if (!rey) return undefined;
    const n = 34 - (toUtcDay(rey.fecha) - toUtcDay(fecha)) / 7;
    return n >= 1 && n <= 34 ? n : undefined;
  }
  return undefined;
}

/**
 * El día litúrgico de una fecha. Si el año no está en la ventana del
 * calendario (`liturgicalWindow.test.ts` avisa antes de que pase), devuelve
 * Tiempo Ordinario sin número ni fiesta, pero con el ciclo bien.
 */
export function liturgicalDayOf(fecha: string): LiturgicalDay {
  const calYear = calendar[fecha.slice(0, 4)];
  const season = seasonOf(calYear, fecha);
  const info = getLiturgicalInfo(fecha);
  const special = calYear?.fechas_especiales?.find((d) => d.fecha === fecha);
  const sundayNumber = sundayNumberOf(calYear, season, fecha);

  // «Corpus Christi (domingo)» → «Corpus Christi»: el paréntesis distingue las
  // dos fechas en el calendario, no es un nombre que enseñar.
  const feastName = special
    ? (FEAST_LONG_NAMES[special.id] ??
      special.nombre.replace(/\s*\((domingo|jueves)\)$/, ''))
    : undefined;

  let name: string;
  if (sundayNumber !== undefined) {
    name = `${toRoman(sundayNumber)} ${SEASON_SUNDAY_LABEL[season]}`;
  } else if (special) {
    name = feastName ?? special.nombre;
  } else if (season === 'navidad' && weekdayOf(fecha) === 0) {
    name = 'II Domingo de Navidad';
  } else {
    name = info.name;
  }

  return {
    fecha,
    season,
    ...(special && { feastId: special.id }),
    ...(sundayNumber !== undefined && { sundayNumber }),
    cycle: cycleOf(fecha),
    name,
    ...(feastName && { feastName }),
    colorHex: info.hex,
  };
}

const WEEKDAYS_ES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];
const MONTHS_ES = [
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

/** «Domingo 22 de noviembre». Sin `Intl`: Hermes no siempre trae `es`. */
export function longDateEs(fecha: string): string {
  const [, m, d] = fecha.split('-').map(Number);
  return `${WEEKDAYS_ES[weekdayOf(fecha)]} ${d} de ${MONTHS_ES[m - 1]}`;
}

/** «22 nov»: para el nombre de una playlist o una fila. */
export function shortDateEs(fecha: string): string {
  const [, m, d] = fecha.split('-').map(Number);
  return `${d} ${MONTHS_ES[m - 1].slice(0, 3)}`;
}

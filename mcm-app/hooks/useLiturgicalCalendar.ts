import calendarioData from '@/assets/calendario-liturgico.json';

interface TiempoEntry {
  id: string;
  nombre: string;
  inicio: string;
  fin: string;
}

interface FechaEspecial {
  id: string;
  fecha: string;
  nombre: string;
}

interface CalendarioYear {
  pascua: string;
  ciclo_dominical: string;
  ciclo_ferial: string;
  tiempos: TiempoEntry[];
  fechas_especiales: FechaEspecial[];
  domingos_adviento: string[];
  domingos_cuaresma: string[];
}

export interface LiturgicalInfo {
  /** e.g. 'ordinario', 'cuaresma', 'adviento', 'pascua', 'navidad', 'semana_santa' */
  tiempo: string;
  nombreTiempo: string;
  /** Hex color for the liturgical period */
  color: string;
  /** Special celebration name for this date, if any */
  celebracion: string | null;
  /** True if this is the 3rd Sunday of Advent (Gaudete) */
  isGaudete: boolean;
  /** True if this is the 4th Sunday of Lent (Laetare) */
  isLaetare: boolean;
  /** Lectionary cycle: A, B, or C */
  cicloDominical: string;
}

// Liturgical colors per period
const PERIOD_COLORS: Record<string, string> = {
  navidad: '#F5F5F5',
  ordinario: '#3A7D44',
  cuaresma: '#6B3FA0',
  semana_santa: '#6B3FA0',
  pascua: '#F5F5F5',
  adviento: '#6B3FA0',
};

const ROSE_COLOR = '#D4A0A7'; // Gaudete / Laetare

const FALLBACK: LiturgicalInfo = {
  tiempo: 'ordinario',
  nombreTiempo: 'Tiempo Ordinario',
  color: '#3A7D44',
  celebracion: null,
  isGaudete: false,
  isLaetare: false,
  cicloDominical: 'A',
};

/** Pure function — returns liturgical info for a given ISO date string (YYYY-MM-DD). */
export function getLiturgicalInfo(date: string): LiturgicalInfo {
  const year = date.slice(0, 4);
  const cal = (calendarioData as Record<string, CalendarioYear>)[year];
  if (!cal) return FALLBACK;

  // Find liturgical period
  let tiempo = 'ordinario';
  let nombreTiempo = 'Tiempo Ordinario';
  for (const t of cal.tiempos) {
    if (date >= t.inicio && date <= t.fin) {
      tiempo = t.id;
      nombreTiempo = t.nombre;
      break;
    }
  }

  // Check for rose Sundays
  const isGaudete = cal.domingos_adviento[2] === date;
  const isLaetare = cal.domingos_cuaresma[3] === date;

  let color = PERIOD_COLORS[tiempo] ?? '#3A7D44';
  if (isGaudete || isLaetare) color = ROSE_COLOR;

  // Check special celebrations — these can override color for red feast days
  const especial = cal.fechas_especiales.find((f) => f.fecha === date);
  const SPECIAL_RED_IDS = [
    'pentecostes',
    'san_pedro_pablo',
    'san_juan_bautista',
    'todos_los_santos',
  ];
  if (especial && SPECIAL_RED_IDS.includes(especial.id)) {
    color = '#C41E3A';
  }

  return {
    tiempo,
    nombreTiempo,
    color,
    celebracion: especial?.nombre ?? null,
    isGaudete,
    isLaetare,
    cicloDominical: cal.ciclo_dominical,
  };
}

/** React hook version — memoizes the result for the given date. */
export function useLiturgicalInfo(date: string): LiturgicalInfo {
  // Pure computation, no side effects needed
  return getLiturgicalInfo(date);
}

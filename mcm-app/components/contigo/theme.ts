// ── Contigo theme tokens — used across all contigo screens ──
// Warm, calm palette inspired by the Contigo Redesign mockups.

export const WARM_LIGHT = {
  bg: '#FAF6F0',
  bgDeep: '#F2EAD9',
  bgCard: '#FFFFFF',
  accent: '#C4922A',
  accentLight: 'rgba(196,146,42,0.10)',
  accentMid: 'rgba(196,146,42,0.22)',
  blue: '#2563EB',
  blueLight: 'rgba(37,99,235,0.10)',
  green: '#3A7D44',
  greenLight: 'rgba(58,125,68,0.10)',
  purple: '#7C3AED',
  purpleLight: 'rgba(124,58,237,0.10)',
  fire: '#EA580C',
  text: '#1C1610',
  textSec: '#7A6550',
  textMuted: '#B5A08A',
  border: 'rgba(196,146,42,0.13)',
  shadow: 'rgba(100,70,20,0.08)',
} as const;

export const WARM_DARK = {
  bg: '#1A1712',
  bgDeep: '#100F0C',
  bgCard: '#26221C',
  accent: '#DAA520',
  accentLight: 'rgba(218,165,32,0.12)',
  accentMid: 'rgba(218,165,32,0.25)',
  blue: '#60A5FA',
  blueLight: 'rgba(96,165,250,0.12)',
  green: '#6DBF7E',
  greenLight: 'rgba(109,191,126,0.12)',
  purple: '#A78BFA',
  purpleLight: 'rgba(167,139,250,0.12)',
  fire: '#FB923C',
  text: '#F5EFE3',
  textSec: '#A09A8A',
  textMuted: '#6B6358',
  border: 'rgba(218,165,32,0.12)',
  shadow: 'rgba(0,0,0,0.25)',
} as const;

export type WarmTheme = {
  bg: string;
  bgDeep: string;
  bgCard: string;
  accent: string;
  accentLight: string;
  accentMid: string;
  blue: string;
  blueLight: string;
  green: string;
  greenLight: string;
  purple: string;
  purpleLight: string;
  fire: string;
  text: string;
  textSec: string;
  textMuted: string;
  border: string;
  shadow: string;
};

export const warm = (isDark: boolean): WarmTheme =>
  (isDark ? WARM_DARK : WARM_LIGHT) as WarmTheme;

// ── Habit definitions ──
export const HABITS = {
  evangelio: {
    icon: 'menu-book',
    label: 'Evangelio',
    light: '#2563EB',
    dark: '#60A5FA',
    grad: ['#3B82F6', '#1D4ED8'] as const,
  },
  oracion: {
    icon: 'self-improvement',
    label: 'Oración',
    light: '#C4922A',
    dark: '#DAA520',
    grad: ['#E8A838', '#C4922A'] as const,
  },
  revision: {
    icon: 'search',
    label: 'Revisión',
    light: '#7C3AED',
    dark: '#A78BFA',
    grad: ['#8B5CF6', '#6D28D9'] as const,
  },
} as const;

export type HabitKey = keyof typeof HABITS;

export const habitColor = (key: HabitKey, isDark: boolean) =>
  isDark ? HABITS[key].dark : HABITS[key].light;

// ── Date helpers ──
export const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const DAYS_ES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];
export const MONTHS_ES = [
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
export const MONTHS_CAP = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export function offsetDate(base: string, delta: number): string {
  const [y, m, d] = base.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return [
    dt.getFullYear(),
    String(dt.getMonth() + 1).padStart(2, '0'),
    String(dt.getDate()).padStart(2, '0'),
  ].join('-');
}

export function formatDateLong(ds: string): string {
  const [y, m, d] = ds.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAYS_ES[dt.getDay()]}, ${d} de ${MONTHS_ES[m - 1]}`;
}

export function getWeekDates(todayStr: string): string[] {
  const [y, m, d] = todayStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = (dt.getDay() + 6) % 7; // Mon = 0
  const monday = new Date(dt);
  monday.setDate(dt.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return [
      dd.getFullYear(),
      String(dd.getMonth() + 1).padStart(2, '0'),
      String(dd.getDate()).padStart(2, '0'),
    ].join('-');
  });
}

export function buildCalendar(ds: string) {
  const [y, m] = ds.split('-').map(Number);
  const dim = new Date(y, m, 0).getDate();
  const first = new Date(y, m - 1, 1).getDay();
  const offset = (first + 6) % 7; // Monday-first
  const cells: (number | null)[] = Array(offset).fill(null);
  for (let i = 1; i <= dim; i++) cells.push(i);
  return { cells, year: y, month: m, dim };
}

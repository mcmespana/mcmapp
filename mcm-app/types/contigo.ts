// types/contigo.ts — Tipos para la sección "Contigo"

// ── Habit Tracker ──

export type PrayerDuration =
  | 'less_than_1'
  | '2_to_4'
  | '5_to_10'
  | '10_to_15'
  | 'more_than_15';

export type Emotion = 'joy' | 'sadness' | 'anger' | 'fear' | 'disgust';

export interface DayRecord {
  date: string; // 'YYYY-MM-DD'
  readingDone: boolean;
  prayerDone: boolean;
  prayerDuration?: PrayerDuration;
  prayerEmotion?: Emotion;
  examenDone?: boolean;
  timestamp: number;
}

export interface MonthStats {
  readingDays: number;
  prayerDays: number;
  examenDays: number;
  totalPrayerMinutes: number;
  mostFrequentEmotion: Emotion | null;
  currentStreak: number;
}

// ── Liturgical Calendar ──

export type LiturgicalSeasonId =
  | 'adviento'
  | 'navidad'
  | 'ordinario'
  | 'cuaresma'
  | 'semana_santa'
  | 'pascua';

export interface LiturgicalSeason {
  id: LiturgicalSeasonId;
  nombre: string;
  inicio: string;
  fin: string;
}

export interface LiturgicalSpecialDate {
  id: string;
  fecha: string;
  nombre: string;
}

export interface LiturgicalYear {
  pascua: string;
  ciclo_dominical: string;
  ciclo_ferial: string;
  tiempos: LiturgicalSeason[];
  fechas_especiales: LiturgicalSpecialDate[];
  domingos_adviento?: string[];
  domingos_cuaresma?: string[];
}

export interface LiturgicalInfo {
  season: LiturgicalSeason | null;
  specialDate: LiturgicalSpecialDate | null;
  color: string;
  colorName: string;
}

// ── Daily Readings (Firebase) ──

export interface ReadingData {
  activo?: string;
  vidaNuevaCita?: string;
  vidaNuevaComentario?: string;
  vidaNuevaComentarista?: string;
  vidaNuevaEvangelioTexto?: string;
  vidaNuevaLastUpdated?: string;
  vidaNuevaURL?: string;
  // Generic prefix-based fields
  [key: string]: string | undefined;
}

export interface DayInfo {
  activo?: string;
  vidaNuevaDiaLiturgico?: string;
  vidaNuevaCita?: string;
  vidaNuevaPrimeraLectura?: string;
  vidaNuevaSegundaLectura?: string;
  vidaNuevaSalmo?: string;
  vidaNuevaTitulo?: string;
  [key: string]: string | undefined;
}

export interface DailyReadings {
  evangelio?: ReadingData;
  lectura1?: ReadingData;
  lectura2?: ReadingData;
  info?: DayInfo;
}

// ── Emotion config ──

export interface EmotionConfig {
  key: Emotion;
  label: string;
  emoji: string;
  color: string;
}

export const EMOTIONS: EmotionConfig[] = [
  { key: 'joy', label: 'Alegría', emoji: '😊', color: '#FCD200' },
  { key: 'sadness', label: 'Tristeza', emoji: '😢', color: '#31AADF' },
  { key: 'anger', label: 'Enfado', emoji: '😤', color: '#E15C62' },
  { key: 'fear', label: 'Miedo', emoji: '😰', color: '#6B3FA0' },
  { key: 'disgust', label: 'Rechazo', emoji: '😣', color: '#3A7D44' },
];

// ── Duration config ──

export interface DurationConfig {
  key: PrayerDuration;
  label: string;
  shortLabel: string;
  estimatedMinutes: number;
}

export const DURATIONS: DurationConfig[] = [
  {
    key: 'less_than_1',
    label: '< 1 min',
    shortLabel: '<1m',
    estimatedMinutes: 0.5,
  },
  {
    key: '2_to_4',
    label: '2–4 min',
    shortLabel: '2-4m',
    estimatedMinutes: 3,
  },
  {
    key: '5_to_10',
    label: '5–10 min',
    shortLabel: '5-10m',
    estimatedMinutes: 7.5,
  },
  {
    key: '10_to_15',
    label: '10–15 min',
    shortLabel: '10-15m',
    estimatedMinutes: 12.5,
  },
  {
    key: 'more_than_15',
    label: '> 15 min',
    shortLabel: '>15m',
    estimatedMinutes: 20,
  },
];

// ── Liturgical Colors ──

export const LITURGICAL_COLORS: Record<string, { hex: string; name: string }> =
  {
    verde: { hex: '#3A7D44', name: 'Verde' },
    morado: { hex: '#6B3FA0', name: 'Morado' },
    blanco: { hex: '#B0B0B0', name: 'Blanco' },
    rojo: { hex: '#C41E3A', name: 'Rojo' },
    rosa: { hex: '#D4A0A7', name: 'Rosa' },
    azul: { hex: '#2B4C7E', name: 'Azul' },
    dorado: { hex: '#D4AF37', name: 'Dorado' },
  };

/** Map season ID → default liturgical color key */
export const SEASON_COLOR_MAP: Record<LiturgicalSeasonId, string> = {
  adviento: 'morado',
  navidad: 'blanco',
  ordinario: 'verde',
  cuaresma: 'morado',
  semana_santa: 'morado',
  pascua: 'blanco',
};

/** Special dates that override the season color */
export const SPECIAL_DATE_COLORS: Record<string, string> = {
  pentecostes: 'rojo',
  domingo_ramos: 'rojo',
  viernes_santo: 'rojo',
};

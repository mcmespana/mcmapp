/**
 * Lógica pura de los recordatorios de Contigo (sin React ni expo-notifications,
 * para poder probarla suelta). La programación real vive en
 * `services/contigoReminders.ts`; la pantalla, en
 * `app/(tabs)/contigo/recordatorios.tsx`.
 *
 * Cómo funciona «solo si aún no lo has hecho»: un aviso local no puede mirar
 * si has hecho el hábito en el momento de sonar. Así que NO se programa nada
 * repetido: se programan los avisos de los próximos días, uno a uno, y cada vez
 * que algo cambia (abres la app, marcas un hábito, tocas un ajuste) se
 * recalcula todo. Si hoy ya has hecho el evangelio, a ese hábito no le quedan
 * avisos hoy.
 */
import type { DayRecord } from '@/contexts/ContigoHabitsContext';
import { CONTIGO_REMINDER_TEXTS } from '@/constants/contigoReminderTexts';
import { localISO, offsetISODate } from '@/utils/localDate';

export type ReminderHabit = 'evangelio' | 'oracion' | 'revision';

/** El orden en que se enseñan (el mismo que las fichas de la portada). */
export const REMINDER_HABITS: readonly ReminderHabit[] = [
  'evangelio',
  'oracion',
  'revision',
];

/** Cuántos avisos al día, como mucho, por hábito. */
export const MAX_TIMES = 3;

/** Todos los días de la semana (1 = lunes … 7 = domingo, ISO). */
export const ALL_DAYS: readonly number[] = [1, 2, 3, 4, 5, 6, 7];

/** Marca de `textIndex` para «escribir el mío». */
export const CUSTOM_TEXT = -1;

/** Tope del texto propio. */
export const CUSTOM_TEXT_MAX = 120;

export interface HabitReminder {
  enabled: boolean;
  /** `HH:MM`, ordenadas, entre 1 y `MAX_TIMES`. */
  times: string[];
  /** 1 = lunes … 7 = domingo, ordenados y sin repetir; nunca vacío. */
  days: number[];
  /** Índice en `first` del texto elegido, o `CUSTOM_TEXT`. */
  textIndex: number;
  customText: string;
}

export type ReminderConfig = Record<ReminderHabit, HabitReminder>;

/** La hora con la que arranca cada hábito al activarlo por primera vez. */
export const DEFAULT_TIMES: Record<ReminderHabit, string> = {
  evangelio: '08:00',
  oracion: '13:00',
  revision: '21:30',
};

export const defaultHabitReminder = (habit: ReminderHabit): HabitReminder => ({
  enabled: false,
  times: [DEFAULT_TIMES[habit]],
  days: [...ALL_DAYS],
  textIndex: 0,
  customText: '',
});

export const defaultReminderConfig = (): ReminderConfig => ({
  evangelio: defaultHabitReminder('evangelio'),
  oracion: defaultHabitReminder('oracion'),
  revision: defaultHabitReminder('revision'),
});

// ── Normalización (lo guardado puede venir viejo, a medias o roto) ───────────

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** `H:MM`/`HH:MM` → `HH:MM`, o `null` si no es una hora. */
export function normalizeTime(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const m = TIME_RE.exec(raw.trim());
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

/** Ordena, quita repetidas y recorta a `MAX_TIMES`. */
export function cleanTimes(times: readonly unknown[]): string[] {
  const out = new Set<string>();
  for (const t of times) {
    const n = normalizeTime(t);
    if (n) out.add(n);
  }
  return [...out].sort().slice(0, MAX_TIMES);
}

export function cleanDays(days: readonly unknown[]): number[] {
  const out = new Set<number>();
  for (const d of days) {
    if (typeof d === 'number' && Number.isInteger(d) && d >= 1 && d <= 7) {
      out.add(d);
    }
  }
  return [...out].sort((a, b) => a - b);
}

function normalizeHabit(raw: unknown, habit: ReminderHabit): HabitReminder {
  const base = defaultHabitReminder(habit);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<Record<keyof HabitReminder, unknown>>;
  const times = Array.isArray(r.times) ? cleanTimes(r.times) : [];
  const days = Array.isArray(r.days) ? cleanDays(r.days) : [];
  const first = CONTIGO_REMINDER_TEXTS[habit].first;
  const idx = r.textIndex;
  const textIndex =
    idx === CUSTOM_TEXT
      ? CUSTOM_TEXT
      : typeof idx === 'number' &&
          Number.isInteger(idx) &&
          idx >= 0 &&
          idx < first.length
        ? idx
        : 0;
  return {
    enabled: r.enabled === true,
    times: times.length ? times : base.times,
    days: days.length ? days : base.days,
    textIndex,
    customText:
      typeof r.customText === 'string'
        ? r.customText.slice(0, CUSTOM_TEXT_MAX)
        : '',
  };
}

export function normalizeReminderConfig(raw: unknown): ReminderConfig {
  const o =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    evangelio: normalizeHabit(o.evangelio, 'evangelio'),
    oracion: normalizeHabit(o.oracion, 'oracion'),
    revision: normalizeHabit(o.revision, 'revision'),
  };
}

/** ¿Hay algún recordatorio encendido? */
export const anyReminderEnabled = (config: ReminderConfig): boolean =>
  REMINDER_HABITS.some((h) => config[h].enabled);

// ── Textos ────────────────────────────────────────────────────────────────────

/**
 * El texto del aviso nº `index` (0 = el primero del día). Con texto propio,
 * ese para todos. Sin él: el elegido para el primero, y para los siguientes los
 * de insistencia, rotando a partir del elegido para que no sea siempre el
 * mismo.
 */
export function reminderMessage(
  habit: ReminderHabit,
  reminder: Pick<HabitReminder, 'textIndex' | 'customText'>,
  index: number,
): { title: string; body: string } {
  const texts = CONTIGO_REMINDER_TEXTS[habit];
  const custom = reminder.customText.trim();
  if (reminder.textIndex === CUSTOM_TEXT && custom) {
    return { title: texts.title, body: custom };
  }
  const chosen = reminder.textIndex === CUSTOM_TEXT ? 0 : reminder.textIndex;
  if (index <= 0 || texts.again.length === 0) {
    return { title: texts.title, body: texts.first[chosen] ?? texts.first[0] };
  }
  return {
    title: texts.title,
    body: texts.again[(chosen + index - 1) % texts.again.length],
  };
}

// ── Estado «hecho» ────────────────────────────────────────────────────────────

export function isHabitDone(
  record: Partial<DayRecord> | null | undefined,
  habit: ReminderHabit,
): boolean {
  if (!record) return false;
  if (habit === 'evangelio') return !!record.readingDone;
  if (habit === 'oracion') return !!record.prayerDone;
  return !!record.revisionDone;
}

// ── Plan de avisos ────────────────────────────────────────────────────────────

/** Prefijo de todo lo que programa Contigo (para borrarlo sin tocar lo demás). */
export const REMINDER_ID_PREFIX = 'contigo-rem-';

/** Cuántos días por delante se programan. */
export const WINDOW_DAYS = 6;

/**
 * Tope de avisos pendientes. iOS admite 64 notificaciones locales a la vez en
 * toda la app; el área de Comunica usa una, y esto deja margen.
 */
export const MAX_SCHEDULED = 56;

/** Pantalla a la que lleva cada aviso al tocarlo. */
export const REMINDER_ROUTES: Record<ReminderHabit, string> = {
  evangelio: '/(tabs)/contigo/evangelio',
  oracion: '/(tabs)/contigo/oracion',
  revision: '/(tabs)/contigo/revision',
};

export interface PlannedReminder {
  /** Identificador estable: `contigo-rem-<hábito>-<fecha>-<nº>`. */
  id: string;
  habit: ReminderHabit;
  at: Date;
  title: string;
  body: string;
  data: {
    contigoReminder: true;
    habit: ReminderHabit;
    internalRoute: string;
  };
}

/** Lunes = 1 … domingo = 7 para una fecha `YYYY-MM-DD` en hora local. */
export function isoWeekday(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const wd = new Date(y, m - 1, d).getDay(); // domingo = 0
  return wd === 0 ? 7 : wd;
}

function atTime(dateStr: string, time: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

/**
 * Los avisos que hay que tener programados ahora mismo: los de los próximos
 * `WINDOW_DAYS + 1` días de los hábitos encendidos, sin los que ya han pasado
 * y sin los de hoy de un hábito que hoy ya está hecho. Ordenados por hora y
 * recortados a `MAX_SCHEDULED` (los más próximos).
 */
export function planReminders(
  config: ReminderConfig,
  records: Record<string, Partial<DayRecord>>,
  now: Date = new Date(),
): PlannedReminder[] {
  const today = localISO(now);
  const planned: PlannedReminder[] = [];

  for (let offset = 0; offset <= WINDOW_DAYS; offset++) {
    const date = offsetISODate(today, offset);
    const weekday = isoWeekday(date);
    for (const habit of REMINDER_HABITS) {
      const reminder = config[habit];
      if (!reminder.enabled || !reminder.days.includes(weekday)) continue;
      if (offset === 0 && isHabitDone(records[today], habit)) continue;
      reminder.times.forEach((time, index) => {
        const at = atTime(date, time);
        if (at.getTime() <= now.getTime()) return;
        planned.push({
          id: `${REMINDER_ID_PREFIX}${habit}-${date}-${index}`,
          habit,
          at,
          ...reminderMessage(habit, reminder, index),
          data: {
            contigoReminder: true,
            habit,
            internalRoute: REMINDER_ROUTES[habit],
          },
        });
      });
    }
  }

  return planned
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_SCHEDULED);
}

/** ¿El `data` de una notificación es de un recordatorio de Contigo? */
export function isContigoReminderData(
  data: unknown,
): data is PlannedReminder['data'] {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    d.contigoReminder === true &&
    typeof d.internalRoute === 'string' &&
    Object.values(REMINDER_ROUTES).includes(d.internalRoute)
  );
}

// ── Resumen para la tarjeta ───────────────────────────────────────────────────

const DAY_SHORT = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

/** «todos los días», «de lunes a viernes» o «lun, mié, vie». */
export function daysSummary(days: readonly number[]): string {
  if (days.length === 7) return 'todos los días';
  if (days.length === 5 && days.every((d) => d <= 5)) {
    return 'de lunes a viernes';
  }
  return days.map((d) => DAY_SHORT[d - 1]).join(', ');
}

/**
 * «Tu año en Contigo»: las cuentas. Puro: recibe los días registrados y los
 * guardados y devuelve el resumen de un año, mes a mes.
 */
import type { DayRecord } from '@/contexts/ContigoHabitsContext';
import {
  HIGHLIGHT_SOURCES,
  type HighlightSource,
  type StoredBookmark,
} from '@/utils/contigoBookmarks';
import type { HighlightColorKey } from '@/utils/highlightRanges';

export interface RecapHighlight {
  date: string;
  source: HighlightSource;
  text: string;
  color?: HighlightColorKey;
}

export interface RecapMonth {
  /** 0 = enero. */
  month: number;
  /** Por día del mes: cuántos de los tres hábitos (0-3). */
  days: number[];
  activeDays: number;
  highlights: RecapHighlight[];
}

export interface Recap {
  year: number;
  /** Días con al menos un hábito. */
  activeDays: number;
  readings: number;
  prayers: number;
  revisions: number;
  prayerMinutes: number;
  /** Racha más larga de días seguidos con algo hecho. */
  longestStreak: number;
  highlights: number;
  months: RecapMonth[];
  /** Mes con más días (o -1). */
  bestMonth: number;
}

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const level = (r: DayRecord | undefined) =>
  r
    ? (r.readingDone ? 1 : 0) +
      (r.prayerDone ? 1 : 0) +
      (r.revisionDone ? 1 : 0)
    : 0;

export function buildRecap(
  records: Record<string, DayRecord>,
  bookmarks: StoredBookmark[],
  year: number,
): Recap {
  const months: RecapMonth[] = [];
  const out: Recap = {
    year,
    activeDays: 0,
    readings: 0,
    prayers: 0,
    revisions: 0,
    prayerMinutes: 0,
    longestStreak: 0,
    highlights: 0,
    months,
    bestMonth: -1,
  };
  let run = 0;
  for (let m = 0; m < 12; m++) {
    const count = new Date(year, m + 1, 0).getDate();
    const days: number[] = [];
    let active = 0;
    for (let d = 1; d <= count; d++) {
      const r = records[iso(year, m, d)];
      const lv = level(r);
      days.push(lv);
      if (lv > 0) {
        active += 1;
        run += 1;
        if (run > out.longestStreak) out.longestStreak = run;
      } else run = 0;
      if (r?.readingDone) out.readings += 1;
      if (r?.prayerDone) {
        out.prayers += 1;
        out.prayerMinutes += r.prayerDurationMinutes || 0;
      }
      if (r?.revisionDone) out.revisions += 1;
    }
    out.activeDays += active;
    months.push({ month: m, days, activeDays: active, highlights: [] });
  }

  const prefix = `${year}-`;
  for (const b of bookmarks) {
    if (!b.date?.startsWith(prefix)) continue;
    const m = Number(b.date.slice(5, 7)) - 1;
    if (!(m >= 0 && m < 12)) continue;
    for (const source of HIGHLIGHT_SOURCES) {
      for (const hl of b.highlights?.[source] ?? []) {
        const text = (typeof hl === 'string' ? hl : hl.text)?.trim();
        if (!text) continue;
        months[m].highlights.push({
          date: b.date,
          source,
          text,
          color: typeof hl === 'string' ? undefined : hl.color,
        });
        out.highlights += 1;
      }
    }
  }
  for (const mo of months)
    mo.highlights.sort((a, b) => a.date.localeCompare(b.date));

  let best = 0;
  months.forEach((mo) => {
    if (mo.activeDays > best) {
      best = mo.activeDays;
      out.bestMonth = mo.month;
    }
  });
  return out;
}

/** Años con algo que enseñar, del más reciente al más antiguo. */
export function recapYears(
  records: Record<string, DayRecord>,
  bookmarks: StoredBookmark[],
  currentYear: number,
): number[] {
  const years = new Set<number>([currentYear]);
  for (const [date, r] of Object.entries(records)) {
    if (level(r) > 0) years.add(Number(date.slice(0, 4)));
  }
  for (const b of bookmarks) years.add(Number(b.date?.slice(0, 4)));
  return [...years]
    .filter((y) => y > 2000 && y <= currentYear)
    .sort((a, b) => b - a);
}

/** «1.240» */
export function formatCount(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

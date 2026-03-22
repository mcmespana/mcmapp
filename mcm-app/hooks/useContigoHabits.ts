// hooks/useContigoHabits.ts — Habit tracker with AsyncStorage persistence
import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  DayRecord,
  PrayerDuration,
  Emotion,
  MonthStats,
} from '@/types/contigo';
import { DURATIONS } from '@/types/contigo';

const STORAGE_KEY = '@contigo_habits';

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Monday-based week start for a given date string */
function getWeekStartDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? 6 : day - 1; // Monday = 0
  date.setDate(date.getDate() - diff);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getWeekDates(weekStart: string): string[] {
  const [y, m, d] = weekStart.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });
}

export default function useContigoHabits() {
  const [records, setRecords] = useState<Record<string, DayRecord>>({});
  const [loading, setLoading] = useState(true);

  // Load from storage
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setRecords(JSON.parse(raw));
      })
      .catch((e) => console.error('Error loading habits:', e))
      .finally(() => setLoading(false));
  }, []);

  // Persist to storage
  const persist = useCallback((updated: Record<string, DayRecord>) => {
    setRecords(updated);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch((e) =>
      console.error('Error saving habits:', e),
    );
  }, []);

  const getRecord = useCallback(
    (date: string): DayRecord | null => records[date] ?? null,
    [records],
  );

  const setReadingDone = useCallback(
    (date: string, done: boolean) => {
      const existing = records[date];
      const updated = {
        ...records,
        [date]: {
          ...(existing ?? {
            date,
            readingDone: false,
            prayerDone: false,
          }),
          date,
          readingDone: done,
          timestamp: Date.now(),
        } as DayRecord,
      };
      persist(updated);
    },
    [records, persist],
  );

  const setPrayerDone = useCallback(
    (date: string, duration: PrayerDuration, emotion: Emotion) => {
      const existing = records[date];
      const updated = {
        ...records,
        [date]: {
          ...(existing ?? {
            date,
            readingDone: false,
            prayerDone: false,
          }),
          date,
          prayerDone: true,
          prayerDuration: duration,
          prayerEmotion: emotion,
          timestamp: Date.now(),
        } as DayRecord,
      };
      persist(updated);
    },
    [records, persist],
  );

  const clearPrayer = useCallback(
    (date: string) => {
      const existing = records[date];
      if (!existing) return;
      const updated = {
        ...records,
        [date]: {
          ...existing,
          prayerDone: false,
          prayerDuration: undefined,
          prayerEmotion: undefined,
          timestamp: Date.now(),
        } as DayRecord,
      };
      persist(updated);
    },
    [records, persist],
  );

  const getStreak = useCallback(
    (habit: 'reading' | 'prayer' | 'examen'): number => {
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const rec = records[key];
        const done =
          habit === 'reading'
            ? rec?.readingDone
            : habit === 'prayer'
              ? rec?.prayerDone
              : rec?.examenDone;
        if (done) {
          streak++;
        } else if (i > 0) {
          // Allow today to be not done yet without breaking streak
          break;
        }
      }
      return streak;
    },
    [records],
  );

  const getWeekSummary = useCallback(
    (weekStartDate: string): (DayRecord | null)[] => {
      const dates = getWeekDates(weekStartDate);
      return dates.map((d) => records[d] ?? null);
    },
    [records],
  );

  const getMonthStats = useCallback(
    (year: number, month: number): MonthStats => {
      const daysInMonth = new Date(year, month, 0).getDate();
      let readingDays = 0;
      let prayerDays = 0;
      let examenDays = 0;
      let totalMinutes = 0;
      const emotionCounts: Record<string, number> = {};

      for (let d = 1; d <= daysInMonth; d++) {
        const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const rec = records[key];
        if (!rec) continue;
        if (rec.readingDone) readingDays++;
        if (rec.prayerDone) {
          prayerDays++;
          if (rec.prayerDuration) {
            const dur = DURATIONS.find((x) => x.key === rec.prayerDuration);
            if (dur) totalMinutes += dur.estimatedMinutes;
          }
          if (rec.prayerEmotion) {
            emotionCounts[rec.prayerEmotion] =
              (emotionCounts[rec.prayerEmotion] ?? 0) + 1;
          }
        }
        if (rec.examenDone) examenDays++;
      }

      const mostFrequentEmotion = Object.entries(emotionCounts).sort(
        ([, a], [, b]) => b - a,
      )[0]?.[0] as Emotion | undefined;

      return {
        readingDays,
        prayerDays,
        examenDays,
        totalPrayerMinutes: Math.round(totalMinutes),
        mostFrequentEmotion: mostFrequentEmotion ?? null,
        currentStreak: getStreak('reading'),
      };
    },
    [records, getStreak],
  );

  const todayStr = getTodayStr();
  const todayRecord = records[todayStr] ?? null;

  // Best streak across all habits
  const bestStreak = useMemo(() => {
    const r = getStreak('reading');
    const p = getStreak('prayer');
    return Math.max(r, p);
  }, [getStreak]);

  return {
    loading,
    records,
    getRecord,
    setReadingDone,
    setPrayerDone,
    clearPrayer,
    getStreak,
    getWeekSummary,
    getMonthStats,
    todayRecord,
    todayStr,
    bestStreak,
    getWeekStartDate,
    getWeekDates,
  };
}

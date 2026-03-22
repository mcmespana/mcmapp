import { useEffect, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Types ──

export type PrayerDuration =
  | 'less_than_1'
  | '2_to_4'
  | '5_to_10'
  | '10_to_15'
  | 'more_than_15';

export type Emotion =
  | 'joy'
  | 'sadness'
  | 'anger'
  | 'fear'
  | 'disgust';

export interface DayRecord {
  date: string;
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

const STORAGE_KEY = '@contigo_habits';

const DURATION_MINUTES: Record<PrayerDuration, number> = {
  less_than_1: 1,
  '2_to_4': 3,
  '5_to_10': 7,
  '10_to_15': 12,
  more_than_15: 20,
};

export const EMOTION_CONFIG: Record<
  Emotion,
  { label: string; color: string; icon: string }
> = {
  joy: { label: 'Alegría', color: '#FCD200', icon: 'sentiment-very-satisfied' },
  sadness: { label: 'Tristeza', color: '#31AADF', icon: 'sentiment-dissatisfied' },
  anger: { label: 'Enfado', color: '#E15C62', icon: 'sentiment-very-dissatisfied' },
  fear: { label: 'Miedo', color: '#6B3FA0', icon: 'sentiment-neutral' },
  disgust: { label: 'Rechazo', color: '#3A7D44', icon: 'sentiment-satisfied' },
};

export const DURATION_CONFIG: Record<PrayerDuration, { label: string; short: string }> = {
  less_than_1: { label: 'Menos de 1 min', short: '<1' },
  '2_to_4': { label: '2–4 min', short: '2-4' },
  '5_to_10': { label: '5–10 min', short: '5-10' },
  '10_to_15': { label: '10–15 min', short: '10-15' },
  more_than_15: { label: 'Más de 15 min', short: '>15' },
};

// ── Helpers ──

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Hook ──

export function useContigoHabits() {
  const [records, setRecords] = useState<Record<string, DayRecord>>({});
  const [loaded, setLoaded] = useState(false);
  const recordsRef = useRef(records);
  recordsRef.current = records;

  // Load from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          setRecords(JSON.parse(raw));
        } catch {
          /* ignore corrupt data */
        }
      }
      setLoaded(true);
    });
  }, []);

  // Persist on change
  useEffect(() => {
    if (loaded) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    }
  }, [records, loaded]);

  const getRecord = useCallback(
    (date: string): DayRecord | null => records[date] ?? null,
    [records],
  );

  const todayRecord = records[getTodayStr()] ?? null;

  const setReadingDone = useCallback((date: string, done: boolean) => {
    setRecords((prev) => ({
      ...prev,
      [date]: {
        ...(prev[date] ?? { date, readingDone: false, prayerDone: false }),
        date,
        readingDone: done,
        timestamp: Date.now(),
      },
    }));
  }, []);

  const setPrayerDone = useCallback(
    (date: string, duration: PrayerDuration, emotion: Emotion) => {
      setRecords((prev) => ({
        ...prev,
        [date]: {
          ...(prev[date] ?? { date, readingDone: false, prayerDone: false }),
          date,
          prayerDone: true,
          prayerDuration: duration,
          prayerEmotion: emotion,
          timestamp: Date.now(),
        },
      }));
    },
    [],
  );

  const clearPrayer = useCallback((date: string) => {
    setRecords((prev) => ({
      ...prev,
      [date]: {
        ...(prev[date] ?? { date, readingDone: false, prayerDone: false }),
        date,
        prayerDone: false,
        prayerDuration: undefined,
        prayerEmotion: undefined,
        timestamp: Date.now(),
      },
    }));
  }, []);

  const getStreak = useCallback(
    (habit: 'reading' | 'prayer' | 'examen'): number => {
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = dateStr(d);
        const rec = recordsRef.current[key];
        const done =
          habit === 'reading'
            ? rec?.readingDone
            : habit === 'prayer'
              ? rec?.prayerDone
              : rec?.examenDone;
        if (done) streak++;
        else if (i > 0) break; // allow today to be pending
        else if (!done && i === 0) break;
      }
      return streak;
    },
    [],
  );

  const getWeekSummary = useCallback(
    (weekStart?: Date): DayRecord[] => {
      const monday = weekStart ?? getMonday(new Date());
      const result: DayRecord[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(d.getDate() + i);
        const key = dateStr(d);
        result.push(
          recordsRef.current[key] ?? {
            date: key,
            readingDone: false,
            prayerDone: false,
            timestamp: 0,
          },
        );
      }
      return result;
    },
    [],
  );

  const getMonthStats = useCallback(
    (year: number, month: number): MonthStats => {
      const stats: MonthStats = {
        readingDays: 0,
        prayerDays: 0,
        examenDays: 0,
        totalPrayerMinutes: 0,
        mostFrequentEmotion: null,
        currentStreak: 0,
      };
      const emotionCounts: Partial<Record<Emotion, number>> = {};
      const daysInMonth = new Date(year, month, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const rec = recordsRef.current[key];
        if (rec?.readingDone) stats.readingDays++;
        if (rec?.prayerDone) {
          stats.prayerDays++;
          if (rec.prayerDuration) {
            stats.totalPrayerMinutes += DURATION_MINUTES[rec.prayerDuration];
          }
          if (rec.prayerEmotion) {
            emotionCounts[rec.prayerEmotion] =
              (emotionCounts[rec.prayerEmotion] ?? 0) + 1;
          }
        }
        if (rec?.examenDone) stats.examenDays++;
      }
      let maxCount = 0;
      for (const [emotion, count] of Object.entries(emotionCounts)) {
        if (count > maxCount) {
          maxCount = count;
          stats.mostFrequentEmotion = emotion as Emotion;
        }
      }
      stats.currentStreak = getStreak('reading');
      return stats;
    },
    [getStreak],
  );

  return {
    loaded,
    records,
    todayRecord,
    getRecord,
    setReadingDone,
    setPrayerDone,
    clearPrayer,
    getStreak,
    getWeekSummary,
    getMonthStats,
  };
}

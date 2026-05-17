import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PrayerDuration =
  | 'less_than_1'
  | '2_to_4'
  | '5_to_10'
  | '10_to_15'
  | 'more_than_15';

export type Emotion = 'joy' | 'sadness' | 'anger' | 'fear' | 'disgust';

export interface DayRecord {
  date: string;
  readingDone: boolean;
  prayerDone: boolean;
  prayerDuration?: PrayerDuration;
  prayerDurationMinutes?: number;
  prayerEmotion?: Emotion;
  /** Daily review completed (paso "Agradecer y revisar"). */
  revisionDone?: boolean;
  timestamp: number;
}

const STORAGE_KEY = '@contigo_habits';

export function useContigoHabits() {
  const [records, setRecords] = useState<Record<string, DayRecord>>({});
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setRecords(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Failed to load contigo habits:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load records on mount
  useEffect(() => {
    load();
  }, []);

  const reloadRecords = () => load();

  // Save changes
  const saveRecords = async (newRecords: Record<string, DayRecord>) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newRecords));
      setRecords(newRecords);
    } catch (err) {
      console.error('Failed to save contigo habits:', err);
    }
  };

  const getRecord = (date: string): DayRecord | null => {
    return records[date] || null;
  };

  const ensureRecord = (date: string): DayRecord => {
    return (
      records[date] || {
        date,
        readingDone: false,
        prayerDone: false,
        timestamp: Date.now(),
      }
    );
  };

  const setReadingDone = async (date: string, done: boolean) => {
    const record = ensureRecord(date);
    const newRecords = {
      ...records,
      [date]: { ...record, readingDone: done, timestamp: Date.now() },
    };
    await saveRecords(newRecords);
  };

  const setPrayerDone = async (
    date: string,
    duration: PrayerDuration,
    emotion: Emotion | null,
    durationMinutes?: number,
  ) => {
    const record = ensureRecord(date);
    const newRecords = {
      ...records,
      [date]: {
        ...record,
        prayerDone: true,
        prayerDuration: duration,
        prayerDurationMinutes: durationMinutes,
        prayerEmotion: emotion || undefined,
        timestamp: Date.now(),
      },
    };
    await saveRecords(newRecords);
  };

  const setRevisionDone = async (date: string, done: boolean) => {
    const record = ensureRecord(date);
    const newRecords = {
      ...records,
      [date]: { ...record, revisionDone: done, timestamp: Date.now() },
    };
    await saveRecords(newRecords);
  };

  const isRevisionDone = (date: string): boolean =>
    !!records[date]?.revisionDone;

  // Total prayer minutes during the current ISO week (Mon–Sun) up to `todayStr`.
  // Iterates Mon..todayStr so the value matches the WeekStrip on the home.
  const getTotalMinutesWeek = (todayStr: string): number => {
    const week = getMondayWeek(todayStr);
    let total = 0;
    for (const ds of week) {
      if (ds > todayStr) break;
      total += records[ds]?.prayerDurationMinutes || 0;
    }
    return total;
  };

  // Number of days the gospel has been read this month up to today
  const getReadingsMonth = (todayStr: string): number => {
    const [y, m] = todayStr.split('-').map(Number);
    const today = parseInt(todayStr.split('-')[2], 10);
    const dim = new Date(y, m, 0).getDate();
    let c = 0;
    for (let d = 1; d <= Math.min(today, dim); d++) {
      const ds = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (records[ds]?.readingDone) c++;
    }
    return c;
  };

  // Days this month with at least one of the three habits completed
  const getActiveDaysMonth = (todayStr: string): number => {
    const [y, m] = todayStr.split('-').map(Number);
    const today = parseInt(todayStr.split('-')[2], 10);
    const dim = new Date(y, m, 0).getDate();
    let c = 0;
    for (let d = 1; d <= Math.min(today, dim); d++) {
      const ds = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const r = records[ds];
      if (r && (r.readingDone || r.prayerDone || r.revisionDone)) c++;
    }
    return c;
  };

  const getStreak = (habit: 'reading' | 'prayer' | 'revision'): number => {
    const todayStr = localISO();
    let currentStreak = 0;
    let cursor = todayStr;

    while (true) {
      const record = records[cursor];
      const isDone =
        habit === 'reading'
          ? record?.readingDone
          : habit === 'prayer'
            ? record?.prayerDone
            : record?.revisionDone;

      // If checking today and it's not done, it doesn't break the streak (yet)
      // unless yesterday was also not done
      if (cursor === todayStr && !isDone) {
        // Skip today if not done yet
      } else if (isDone) {
        currentStreak++;
      } else {
        break;
      }
      cursor = offsetISODate(cursor, -1);
    }

    return currentStreak;
  };

  const todayStr = localISO();
  const todayRecord = getRecord(todayStr);

  return {
    isLoading,
    records,
    getRecord,
    setReadingDone,
    setPrayerDone,
    setRevisionDone,
    isRevisionDone,
    getStreak,
    getTotalMinutesWeek,
    getReadingsMonth,
    getActiveDaysMonth,
    todayRecord,
    todayStr,
    reloadRecords,
  };
}

// ── Pure helpers (local-time, no UTC drift) ────────────────────────────────
function localISO(d: Date = new Date()): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function offsetISODate(base: string, delta: number): string {
  const [y, m, d] = base.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return localISO(dt);
}

/** Mon→Sun ISO-week dates that contain `dateStr` (local time). */
function getMondayWeek(dateStr: string): string[] {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = (dt.getDay() + 6) % 7; // Mon = 0
  const monday = new Date(dt);
  monday.setDate(dt.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return localISO(dd);
  });
}

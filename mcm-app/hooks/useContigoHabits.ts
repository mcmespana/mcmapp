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
  prayerEmotion?: Emotion;
  examenDone?: boolean;
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
    emotion: Emotion,
  ) => {
    const record = ensureRecord(date);
    const newRecords = {
      ...records,
      [date]: {
        ...record,
        prayerDone: true,
        prayerDuration: duration,
        prayerEmotion: emotion,
        timestamp: Date.now(),
      },
    };
    await saveRecords(newRecords);
  };

  const setExamenDone = async (date: string, done: boolean) => {
    const record = ensureRecord(date);
    const newRecords = {
      ...records,
      [date]: { ...record, examenDone: done, timestamp: Date.now() },
    };
    await saveRecords(newRecords);
  };

  const getStreak = (habit: 'reading' | 'prayer' | 'examen'): number => {
    const todayStr = new Date().toISOString().split('T')[0];
    let currentStreak = 0;
    const date = new Date(todayStr);

    while (true) {
      const dateStr = date.toISOString().split('T')[0];
      const record = records[dateStr];
      const isDone =
        habit === 'reading'
          ? record?.readingDone
          : habit === 'prayer'
            ? record?.prayerDone
            : record?.examenDone;

      // If checking today and it's not done, it doesn't break the streak (yet)
      // unless yesterday was also not done
      if (dateStr === todayStr && !isDone) {
        // Skip today if not done yet
      } else if (isDone) {
        currentStreak++;
      } else {
        break;
      }
      date.setDate(date.getDate() - 1);
    }

    return currentStreak;
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecord = getRecord(todayStr);

  return {
    isLoading,
    getRecord,
    setReadingDone,
    setPrayerDone,
    setExamenDone,
    getStreak,
    todayRecord,
    todayStr,
    reloadRecords,
  };
}

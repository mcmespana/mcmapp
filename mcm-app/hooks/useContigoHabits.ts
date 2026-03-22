import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HABITS_KEY = '@contigo_habits';

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
  timestamp: number;
}

type HabitsStore = Record<string, DayRecord>;

export const PRAYER_DURATION_LABELS: Record<PrayerDuration, string> = {
  less_than_1: 'Menos de 1 min',
  '2_to_4': '2–4 min',
  '5_to_10': '5–10 min',
  '10_to_15': '10–15 min',
  more_than_15: 'Más de 15 min',
};

export const PRAYER_DURATION_MINUTES: Record<PrayerDuration, number> = {
  less_than_1: 0.5,
  '2_to_4': 3,
  '5_to_10': 7.5,
  '10_to_15': 12.5,
  more_than_15: 20,
};

export const EMOTION_COLORS: Record<Emotion, string> = {
  joy: '#FCD200',
  sadness: '#31AADF',
  anger: '#E15C62',
  fear: '#6B3FA0',
  disgust: '#3A7D44',
};

export const EMOTION_LABELS: Record<Emotion, string> = {
  joy: 'Alegría',
  sadness: 'Tristeza',
  anger: 'Enfado',
  fear: 'Miedo',
  disgust: 'Rechazo',
};

export const EMOTION_EMOJIS: Record<Emotion, string> = {
  joy: '😊',
  sadness: '😢',
  anger: '😠',
  fear: '😰',
  disgust: '😖',
};

async function loadHabits(): Promise<HabitsStore> {
  try {
    const raw = await AsyncStorage.getItem(HABITS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveHabits(habits: HabitsStore): Promise<void> {
  try {
    await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(habits));
  } catch (e) {
    console.error('Error saving contigo habits:', e);
  }
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function useContigoHabits() {
  const [habits, setHabits] = useState<HabitsStore>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadHabits().then((h) => {
      setHabits(h);
      setLoaded(true);
    });
  }, []);

  const getRecord = useCallback(
    (date: string): DayRecord | null => {
      return habits[date] ?? null;
    },
    [habits],
  );

  const setReadingDone = useCallback(
    async (date: string, done: boolean) => {
      const existing = habits[date];
      const updated: HabitsStore = {
        ...habits,
        [date]: {
          date,
          readingDone: done,
          prayerDone: existing?.prayerDone ?? false,
          prayerDuration: existing?.prayerDuration,
          prayerEmotion: existing?.prayerEmotion,
          timestamp: Date.now(),
        },
      };
      setHabits(updated);
      await saveHabits(updated);
    },
    [habits],
  );

  const setPrayerRecord = useCallback(
    async (date: string, duration: PrayerDuration, emotion: Emotion) => {
      const existing = habits[date];
      const updated: HabitsStore = {
        ...habits,
        [date]: {
          date,
          readingDone: existing?.readingDone ?? false,
          prayerDone: true,
          prayerDuration: duration,
          prayerEmotion: emotion,
          timestamp: Date.now(),
        },
      };
      setHabits(updated);
      await saveHabits(updated);
    },
    [habits],
  );

  const clearPrayerRecord = useCallback(
    async (date: string) => {
      const existing = habits[date];
      if (!existing) return;
      const updated: HabitsStore = {
        ...habits,
        [date]: {
          ...existing,
          prayerDone: false,
          prayerDuration: undefined,
          prayerEmotion: undefined,
          timestamp: Date.now(),
        },
      };
      setHabits(updated);
      await saveHabits(updated);
    },
    [habits],
  );

  const getStreak = useCallback(
    (habit: 'reading' | 'prayer'): number => {
      let streak = 0;
      const d = new Date();
      // If today isn't done yet, start checking from yesterday for the streak count
      // to not break the user's streak just because today isn't done
      while (true) {
        const dateStr = d.toISOString().split('T')[0];
        const rec = habits[dateStr];
        const done = habit === 'reading' ? rec?.readingDone : rec?.prayerDone;
        if (!done) break;
        streak++;
        d.setDate(d.getDate() - 1);
      }
      return streak;
    },
    [habits],
  );

  /** Returns ISO date strings for the 7 days of the week containing the given date (Mon–Sun) */
  const getWeekDates = useCallback((anyDateInWeek: string): string[] => {
    const d = new Date(anyDateInWeek + 'T00:00:00');
    // Adjust to Monday (0=Sun, 1=Mon, ..., 6=Sat)
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((day + 6) % 7));

    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const cur = new Date(monday);
      cur.setDate(monday.getDate() + i);
      dates.push(cur.toISOString().split('T')[0]);
    }
    return dates;
  }, []);

  const today = todayISO();
  const todayRecord = habits[today] ?? null;

  return {
    loaded,
    habits,
    getRecord,
    setReadingDone,
    setPrayerRecord,
    clearPrayerRecord,
    getStreak,
    getWeekDates,
    todayRecord,
  };
}

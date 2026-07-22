import { logger } from '@/utils/logger';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import { syncContigoHabit, fetchContigoHabits } from '@/utils/authHelpers';
import { mergeContigoHabits } from '@/utils/contigoMerge';
import { localISO } from '@/utils/localDate';

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
  const { user: authUser } = useAuth();

  const readLocalRecords = async (): Promise<Record<string, DayRecord>> => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (err) {
      logger.error('Failed to load contigo habits:', err);
      return {};
    }
  };

  // Reload local-only (usado al enfocar la pantalla de Contigo, para
  // recoger cambios que otra pantalla haya escrito en AsyncStorage).
  const load = async () => {
    const stored = await readLocalRecords();
    setRecords(stored);
    setIsLoading(false);
  };

  // Carga local al montar / cambiar de sesión y, si hay sesión, hidrata
  // desde RTDB (multi-dispositivo / reinstalación — antes los hábitos solo
  // subían, nunca se leían de vuelta). Fusiona por fecha: gana el registro
  // más completo, a igualdad el local, y re-sube las fechas donde lo local
  // aportó algo que el remoto no tenía.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const localRecords = await readLocalRecords();
      if (mounted) {
        setRecords(localRecords);
        setIsLoading(false);
      }
      if (!authUser) return;
      const remoteRecords = await fetchContigoHabits(authUser.uid);
      if (Object.keys(remoteRecords).length === 0) return;
      const { merged, datesToResync } = mergeContigoHabits(
        localRecords,
        remoteRecords,
      );
      if (mounted) setRecords(merged);
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch (err) {
        logger.error('Failed to persist merged contigo habits:', err);
      }
      for (const date of datesToResync) {
        syncContigoHabit(authUser.uid, date, merged[date]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [authUser]);

  const reloadRecords = () => load();

  // Save changes (local + RTDB sync si el usuario está autenticado)
  const saveRecords = async (
    newRecords: Record<string, DayRecord>,
    changedDate?: string,
  ) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newRecords));
      setRecords(newRecords);
      if (authUser && changedDate && newRecords[changedDate]) {
        syncContigoHabit(authUser.uid, changedDate, newRecords[changedDate]);
      }
    } catch (err) {
      logger.error('Failed to save contigo habits:', err);
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
    await saveRecords(newRecords, date);
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
    await saveRecords(newRecords, date);
  };

  const setRevisionDone = async (date: string, done: boolean) => {
    const record = ensureRecord(date);
    const newRecords = {
      ...records,
      [date]: { ...record, revisionDone: done, timestamp: Date.now() },
    };
    await saveRecords(newRecords, date);
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
// `localISO` vive en utils/localDate.ts (compartida con Home/Calendario/
// Reflexiones — antes cada sitio calculaba "hoy" a su manera y varios lo
// hacían mal con `toISOString()`, que convierte a UTC).

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

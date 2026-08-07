import { logger } from '@/utils/logger';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import { syncContigoHabit, fetchContigoHabits } from '@/utils/authHelpers';
import { mergeContigoHabits } from '@/utils/contigoMerge';
import { localISO } from '@/utils/localDate';

export type PrayerDuration =
  'less_than_1' | '2_to_4' | '5_to_10' | '10_to_15' | 'more_than_15';

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

export interface ContigoHabitsContextValue {
  isLoading: boolean;
  records: Record<string, DayRecord>;
  getRecord: (date: string) => DayRecord | null;
  setReadingDone: (date: string, done: boolean) => Promise<void>;
  setPrayerDone: (
    date: string,
    duration: PrayerDuration,
    emotion: Emotion | null,
    durationMinutes?: number,
  ) => Promise<void>;
  setRevisionDone: (date: string, done: boolean) => Promise<void>;
  isRevisionDone: (date: string) => boolean;
  getStreak: (habit: 'reading' | 'prayer' | 'revision') => number;
  getTotalMinutesWeek: (todayStr: string) => number;
  getReadingsMonth: (todayStr: string) => number;
  getActiveDaysMonth: (todayStr: string) => number;
  todayRecord: DayRecord | null;
  todayStr: string;
  reloadRecords: () => void;
}

export const ContigoHabitsContext =
  createContext<ContigoHabitsContextValue | null>(null);

/**
 * Único dueño del mapa de hábitos de Contigo. Antes cada pantalla
 * (index/evangelio/oracion/revision) montaba su propia instancia de
 * `useContigoHabits` con su propio `records` en el closure: si dos
 * pantallas escribían sin remontarse entre medias, la segunda escritura
 * pisaba el mapa entero con su copia desactualizada y el cambio de la
 * primera desaparecía en silencio. Con un solo provider, todas comparten
 * el mismo estado y las mutaciones parten siempre del valor más reciente
 * (`setRecords(prev => …)`), nunca de un closure viejo.
 */
export function ContigoHabitsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [records, setRecords] = useState<Record<string, DayRecord>>({});
  const [isLoading, setIsLoading] = useState(true);
  const { user: authUser } = useAuth();

  // Fuente de verdad síncrona para las mutaciones: usar SIEMPRE
  // `recordsRef.current`, nunca el `records` cerrado en un closure de
  // render, así dos escrituras seguidas (aunque no haya dado tiempo a
  // re-renderizar entre medias) parten cada una del resultado de la
  // anterior. `commitRecords` mantiene el ref y el state sincronizados.
  const recordsRef = useRef<Record<string, DayRecord>>({});
  const commitRecords = (next: Record<string, DayRecord>) => {
    recordsRef.current = next;
    setRecords(next);
  };

  // Serializa las escrituras a AsyncStorage: dos mutaciones seguidas ya no
  // pueden intercalar sus setItem (una cola de promesas, no Promise.all).
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

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
    commitRecords(stored);
    setIsLoading(false);
  };

  // Carga local al montar / cambiar de sesión y, si hay sesión, hidrata
  // desde RTDB (multi-dispositivo / reinstalación). Fusiona por fecha: gana
  // el registro más completo, a igualdad el local, y re-sube las fechas
  // donde lo local aportó algo que el remoto no tenía. Con un solo
  // provider esto corre UNA vez por sesión de auth, no una vez por pantalla.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const localRecords = await readLocalRecords();
      if (mounted) {
        commitRecords(localRecords);
        setIsLoading(false);
      }
      if (!authUser) return;
      const remoteRecords = await fetchContigoHabits(authUser.uid);
      if (Object.keys(remoteRecords).length === 0) return;
      const { merged, datesToResync } = mergeContigoHabits(
        localRecords,
        remoteRecords,
      );
      if (mounted) commitRecords(merged);
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

  const reloadRecords = () => {
    load();
  };

  // Aplica `updater` sobre `recordsRef.current` (el estado MÁS RECIENTE,
  // nunca un closure desactualizado) y encola la persistencia de ese
  // resultado. La mutación en sí es síncrona (commitRecords); solo la
  // escritura a AsyncStorage/sync remoto queda en la cola de promesas.
  const mutateRecords = useCallback(
    (date: string, updater: (rec: DayRecord) => DayRecord): Promise<void> => {
      const base: DayRecord = recordsRef.current[date] || {
        date,
        readingDone: false,
        prayerDone: false,
        timestamp: Date.now(),
      };
      const next = { ...recordsRef.current, [date]: updater(base) };
      commitRecords(next);

      const write = writeQueueRef.current
        .then(async () => {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          if (authUser) {
            syncContigoHabit(authUser.uid, date, next[date]);
          }
        })
        .catch((err) => {
          logger.error('Failed to save contigo habits:', err);
        });
      writeQueueRef.current = write;
      return write;
    },
    [authUser],
  );

  const getRecord = (date: string): DayRecord | null => records[date] || null;

  const setReadingDone = (date: string, done: boolean) =>
    mutateRecords(date, (rec) => ({
      ...rec,
      readingDone: done,
      timestamp: Date.now(),
    }));

  const setPrayerDone = (
    date: string,
    duration: PrayerDuration,
    emotion: Emotion | null,
    durationMinutes?: number,
  ) =>
    mutateRecords(date, (rec) => ({
      ...rec,
      prayerDone: true,
      prayerDuration: duration,
      prayerDurationMinutes: durationMinutes,
      prayerEmotion: emotion || undefined,
      timestamp: Date.now(),
    }));

  const setRevisionDone = (date: string, done: boolean) =>
    mutateRecords(date, (rec) => ({
      ...rec,
      revisionDone: done,
      timestamp: Date.now(),
    }));

  const isRevisionDone = (date: string): boolean =>
    !!records[date]?.revisionDone;

  // Total prayer minutes during the current ISO week (Mon–Sun) up to `todayStr`.
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

  const value: ContigoHabitsContextValue = {
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

  return (
    <ContigoHabitsContext.Provider value={value}>
      {children}
    </ContigoHabitsContext.Provider>
  );
}

/** Consumidor del context. Lanza si se usa fuera de `ContigoHabitsProvider`. */
export function useContigoHabitsContext(): ContigoHabitsContextValue {
  const ctx = useContext(ContigoHabitsContext);
  if (!ctx) {
    throw new Error(
      'useContigoHabitsContext necesita estar dentro de ContigoHabitsProvider',
    );
  }
  return ctx;
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

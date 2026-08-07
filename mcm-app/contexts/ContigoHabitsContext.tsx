/**
 * Dueño ÚNICO del mapa de hábitos de Contigo (`Record<fecha, DayRecord>`).
 *
 * Antes esto vivía en `useContigoHabits` con estado por instancia, y en el stack
 * de Contigo hay CUATRO instancias vivas a la vez (index, evangelio, oración,
 * revisión). Cada setter construía `{...records, [date]: …}` sobre el `records`
 * cerrado en el closure de SU instancia y escribía el mapa entero en
 * AsyncStorage. Secuencia real: marcas el evangelio leído en `evangelio`, luego
 * completas la revisión en `revision` sin que esa pantalla se haya remontado —
 * la instancia de `revision` escribía su mapa (que no vio el cambio) y el
 * `readingDone` desaparecía del disco, llevándose la racha y los contadores. El
 * re-sync remoto tampoco salvaba: `syncContigoHabit` solo sube la fecha
 * cambiada. El usuario veía des-completarse un hábito que había completado, en
 * silencio.
 *
 * Con un solo dueño hay además dos mejoras colaterales: la hidratación remota
 * corre UNA vez por sesión de auth en vez de cuatro, y las escrituras se
 * serializan con `withStorageLock` (dos taps rápidos ya no intercalan sus
 * `setItem`).
 *
 * El FORMATO de `@contigo_habits` no cambia: los datos ya guardados se leen tal
 * cual.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/utils/logger';
import { useAuth } from '@/contexts/AuthContext';
import { syncContigoHabit, fetchContigoHabits } from '@/utils/authHelpers';
import { mergeContigoHabits } from '@/utils/contigoMerge';
import { localISO } from '@/utils/localDate';
import { withStorageLock } from '@/utils/storageMutex';

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

export const CONTIGO_HABITS_KEY = '@contigo_habits';

type Records = Record<string, DayRecord>;

export interface ContigoHabitsValue {
  isLoading: boolean;
  records: Records;
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
  reloadRecords: () => Promise<void>;
}

export const ContigoHabitsContext = createContext<ContigoHabitsValue | null>(
  null,
);

async function readLocalRecords(): Promise<Records> {
  try {
    const stored = await AsyncStorage.getItem(CONTIGO_HABITS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (err) {
    logger.error('Failed to load contigo habits:', err);
    return {};
  }
}

async function persistRecords(records: Records): Promise<void> {
  try {
    await AsyncStorage.setItem(CONTIGO_HABITS_KEY, JSON.stringify(records));
  } catch (err) {
    logger.error('Failed to save contigo habits:', err);
  }
}

export function ContigoHabitsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [records, setRecords] = useState<Records>({});
  const [isLoading, setIsLoading] = useState(true);
  const { user: authUser } = useAuth();

  // Espejo del estado para leer el mapa VIGENTE dentro del lock, sin depender de
  // qué render cerró el closure. Es la pieza que hace que el segundo tap vea el
  // resultado del primero.
  const recordsRef = useRef<Records>({});

  const applyRecords = useCallback((next: Records) => {
    recordsRef.current = next;
    setRecords(next);
  }, []);

  // Carga local al montar / cambiar de sesión y, si hay sesión, hidrata desde
  // RTDB (multi-dispositivo / reinstalación — antes los hábitos solo subían,
  // nunca se leían de vuelta). Fusiona por fecha: gana el registro más completo,
  // a igualdad el local, y re-sube las fechas donde lo local aportó algo que el
  // remoto no tenía. Con el provider esto ocurre una vez, no cuatro.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const localRecords = await readLocalRecords();
      if (mounted) {
        applyRecords(localRecords);
        setIsLoading(false);
      }
      if (!authUser) return;
      const remoteRecords = await fetchContigoHabits(authUser.uid);
      if (Object.keys(remoteRecords).length === 0) return;
      const { merged, datesToResync } = mergeContigoHabits(
        localRecords,
        remoteRecords,
      );
      if (!mounted) return;
      applyRecords(merged);
      await withStorageLock(CONTIGO_HABITS_KEY, () => persistRecords(merged));
      for (const date of datesToResync) {
        syncContigoHabit(authUser.uid, date, merged[date]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [authUser, applyRecords]);

  /**
   * Único camino de escritura. Todo ocurre dentro del lock de la clave: se lee
   * el mapa vigente, se muta la fecha, se publica y se persiste. Dos taps
   * rápidos se encolan, así que el segundo parte del resultado del primero.
   */
  const mutateRecords = useCallback(
    (date: string, mutate: (record: DayRecord) => DayRecord) =>
      withStorageLock(CONTIGO_HABITS_KEY, async () => {
        const base = recordsRef.current;
        const current: DayRecord = base[date] ?? {
          date,
          readingDone: false,
          prayerDone: false,
          timestamp: Date.now(),
        };
        const next: Records = { ...base, [date]: mutate(current) };
        applyRecords(next);
        await persistRecords(next);
        if (authUser) {
          syncContigoHabit(authUser.uid, date, next[date]);
        }
      }),
    [authUser, applyRecords],
  );

  const setReadingDone = useCallback(
    (date: string, done: boolean) =>
      mutateRecords(date, (rec) => ({
        ...rec,
        readingDone: done,
        timestamp: Date.now(),
      })),
    [mutateRecords],
  );

  const setPrayerDone = useCallback(
    (
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
      })),
    [mutateRecords],
  );

  const setRevisionDone = useCallback(
    (date: string, done: boolean) =>
      mutateRecords(date, (rec) => ({
        ...rec,
        revisionDone: done,
        timestamp: Date.now(),
      })),
    [mutateRecords],
  );

  // Recarga local. Con un solo dueño ya no hace falta para ver los cambios de
  // otra pantalla, pero se mantiene: lo usa el reload al enfocar Contigo.
  const reloadRecords = useCallback(
    () =>
      withStorageLock(CONTIGO_HABITS_KEY, async () => {
        const stored = await readLocalRecords();
        applyRecords(stored);
        setIsLoading(false);
      }),
    [applyRecords],
  );

  const todayStr = localISO();

  const value = useMemo<ContigoHabitsValue>(() => {
    const getRecord = (date: string): DayRecord | null => records[date] || null;

    return {
      isLoading,
      records,
      getRecord,
      setReadingDone,
      setPrayerDone,
      setRevisionDone,
      isRevisionDone: (date: string) => !!records[date]?.revisionDone,

      // Total prayer minutes during the current ISO week (Mon–Sun) up to
      // `todayStr`. Iterates Mon..todayStr so the value matches the WeekStrip.
      getTotalMinutesWeek: (today: string) => {
        let total = 0;
        for (const ds of getMondayWeek(today)) {
          if (ds > today) break;
          total += records[ds]?.prayerDurationMinutes || 0;
        }
        return total;
      },

      // Number of days the gospel has been read this month up to today
      getReadingsMonth: (today: string) =>
        countDaysThisMonth(today, (r) => !!r.readingDone, records),

      // Days this month with at least one of the three habits completed
      getActiveDaysMonth: (today: string) =>
        countDaysThisMonth(
          today,
          (r) => !!(r.readingDone || r.prayerDone || r.revisionDone),
          records,
        ),

      getStreak: (habit: 'reading' | 'prayer' | 'revision') =>
        computeStreak(records, habit),

      todayRecord: getRecord(todayStr),
      todayStr,
      reloadRecords,
    };
  }, [
    records,
    isLoading,
    todayStr,
    setReadingDone,
    setPrayerDone,
    setRevisionDone,
    reloadRecords,
  ]);

  return (
    <ContigoHabitsContext.Provider value={value}>
      {children}
    </ContigoHabitsContext.Provider>
  );
}

export function useContigoHabitsContext(): ContigoHabitsValue {
  const ctx = useContext(ContigoHabitsContext);
  if (!ctx) {
    throw new Error('useContigoHabits necesita ContigoHabitsProvider');
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

/** Cuenta los días del mes de `todayStr`, hasta hoy, que cumplen `pred`. */
function countDaysThisMonth(
  todayStr: string,
  pred: (record: DayRecord) => boolean,
  records: Records,
): number {
  const [y, m] = todayStr.split('-').map(Number);
  const today = parseInt(todayStr.split('-')[2], 10);
  const dim = new Date(y, m, 0).getDate();
  let c = 0;
  for (let d = 1; d <= Math.min(today, dim); d++) {
    const ds = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const r = records[ds];
    if (r && pred(r)) c++;
  }
  return c;
}

function computeStreak(
  records: Records,
  habit: 'reading' | 'prayer' | 'revision',
): number {
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
}

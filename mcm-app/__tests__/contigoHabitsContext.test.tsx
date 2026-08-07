/**
 * Tests del dueño único del mapa de hábitos de Contigo
 * (`contexts/ContigoHabitsContext.tsx`).
 *
 * El bug que fijan (plan `plans/004-contigo-habits-single-writer.md`): el estado
 * vivía por instancia del hook y hay cuatro instancias vivas a la vez en el
 * stack de Contigo. Cada setter escribía el mapa ENTERO desde el `records`
 * cerrado en su propio closure, así que marcar el evangelio en una pantalla y la
 * revisión en otra hacía desaparecer el primero del disco — con su racha y sus
 * contadores.
 */
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';

// `AuthContext` arrastra `firebase/auth`, que se publica como ESM y no pasa por
// el transform de Jest. Aquí solo hace falta "sin sesión": sin `authUser` el
// provider no toca RTDB, que es justo el escenario que interesa aislar.
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ContigoHabitsProvider,
  CONTIGO_HABITS_KEY,
  type DayRecord,
} from '@/contexts/ContigoHabitsContext';
import { useContigoHabits } from '@/hooks/useContigoHabits';
import { __resetStorageLocksForTests } from '@/utils/storageMutex';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ContigoHabitsProvider>{children}</ContigoHabitsProvider>
);

/** Lee el mapa tal como quedó persistido. */
const readDisk = async (): Promise<Record<string, DayRecord>> => {
  const raw = await AsyncStorage.getItem(CONTIGO_HABITS_KEY);
  return raw ? JSON.parse(raw) : {};
};

beforeEach(async () => {
  jest.clearAllMocks();
  __resetStorageLocksForTests();
  await AsyncStorage.clear();
});

describe('ContigoHabitsProvider', () => {
  it('dos consumidores del MISMO provider no se pisan (el bug original)', async () => {
    // Dos consumidores, como `evangelio` y `revision` montados a la vez.
    const { result } = await renderHook(
      () => ({ a: useContigoHabits(), b: useContigoHabits() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.a.isLoading).toBe(false));

    const hoy = result.current.a.todayStr;

    // A marca el evangelio; B, que NO se ha remontado, marca la revisión.
    await act(async () => {
      await result.current.a.setReadingDone(hoy, true);
    });
    await act(async () => {
      await result.current.b.setRevisionDone(hoy, true);
    });

    // Antes, el segundo escribía su mapa (sin el readingDone) y se perdía.
    const disk = await readDisk();
    expect(disk[hoy].readingDone).toBe(true);
    expect(disk[hoy].revisionDone).toBe(true);
    // Y el estado en memoria de los dos consumidores coincide.
    expect(result.current.a.getRecord(hoy)).toEqual(disk[hoy]);
    expect(result.current.b.isRevisionDone(hoy)).toBe(true);
  });

  it('dos escrituras seguidas sin esperar entre ellas: ambas persisten', async () => {
    const { result } = await renderHook(() => useContigoHabits(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const hoy = result.current.todayStr;

    await act(async () => {
      await Promise.all([
        result.current.setReadingDone(hoy, true),
        result.current.setPrayerDone(hoy, '5_to_10', 'joy', 7),
      ]);
    });

    const disk = await readDisk();
    expect(disk[hoy].readingDone).toBe(true);
    expect(disk[hoy].prayerDone).toBe(true);
    expect(disk[hoy].prayerDurationMinutes).toBe(7);
    expect(disk[hoy].prayerEmotion).toBe('joy');
  });

  it('hidrata el formato existente de @contigo_habits sin tocarlo', async () => {
    const fixture: Record<string, DayRecord> = {
      '2026-08-01': {
        date: '2026-08-01',
        readingDone: true,
        prayerDone: true,
        prayerDuration: '10_to_15',
        prayerDurationMinutes: 12,
        prayerEmotion: 'joy',
        revisionDone: true,
        timestamp: 1_700_000_000_000,
      },
      '2026-08-02': {
        date: '2026-08-02',
        readingDone: false,
        prayerDone: false,
        timestamp: 1_700_000_100_000,
      },
    };
    await AsyncStorage.setItem(CONTIGO_HABITS_KEY, JSON.stringify(fixture));

    const { result } = await renderHook(() => useContigoHabits(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.getRecord('2026-08-01')).toEqual(
      fixture['2026-08-01'],
    );
    expect(result.current.getRecord('2026-08-02')).toEqual(
      fixture['2026-08-02'],
    );
    expect(result.current.getRecord('2026-07-31')).toBeNull();
    expect(result.current.isRevisionDone('2026-08-01')).toBe(true);
    expect(result.current.isRevisionDone('2026-08-02')).toBe(false);

    // Los contadores del mes leen el mismo mapa.
    expect(result.current.getReadingsMonth('2026-08-02')).toBe(1);
    expect(result.current.getActiveDaysMonth('2026-08-02')).toBe(1);
    expect(result.current.getTotalMinutesWeek('2026-08-02')).toBe(12);
  });

  it('el hook lanza si falta el provider', async () => {
    const originalError = console.error;
    console.error = jest.fn(); // React imprime el error del render
    await expect(
      (async () => {
        await renderHook(() => useContigoHabits());
      })(),
    ).rejects.toThrow(/ContigoHabitsProvider/);
    console.error = originalError;
  });
});

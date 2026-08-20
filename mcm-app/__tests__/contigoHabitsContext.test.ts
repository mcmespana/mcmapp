/**
 * Test de regresión del Plan 004: antes cada pantalla de Contigo montaba su
 * propia instancia de `useContigoHabits` con su propio `records` en el
 * closure. Si dos pantallas escribían sin remontarse entre medias, la
 * segunda pisaba el mapa entero con su copia vieja y el cambio de la
 * primera desaparecía. Con `ContigoHabitsProvider` como único dueño del
 * estado, dos consumidores bajo el MISMO provider comparten `records` y
 * ninguna escritura se pierde.
 *
 * También cubre los helpers derivados (rachas, minutos de la semana, días
 * activos del mes) y la hidratación multi-dispositivo desde RTDB: se fusiona
 * con lo local (gana el registro más completo) y solo se re-sincronizan las
 * fechas donde lo local aportó algo que el remoto no tenía.
 */
import React from 'react';
import { render, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import {
  syncContigoHabit,
  fetchContigoHabits,
} from '@/utils/authHelpers';
import {
  ContigoHabitsProvider,
  useContigoHabitsContext,
  type ContigoHabitsContextValue,
} from '@/contexts/ContigoHabitsContext';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));
jest.mock('@/utils/authHelpers', () => ({
  syncContigoHabit: jest.fn(() => Promise.resolve()),
  fetchContigoHabits: jest.fn(() => Promise.resolve({})),
}));

const STORAGE_KEY = '@contigo_habits';
const TODAY = '2026-08-06';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ user: null });
  (fetchContigoHabits as jest.Mock).mockResolvedValue({});
});

// Caja mutable (objeto plano, NO una React ref) donde el componente sonda
// deja el value del context para que el test lo lea/llame directamente, sin
// pasar por una instancia de provider separada (que sería un árbol de React
// distinto, con su propio estado — justo el bug que este test verifica que
// ya NO ocurre).
interface Box {
  value: ContigoHabitsContextValue | null;
}

function Consumer({ box }: { box: Box }) {
  box.value = useContigoHabitsContext();
  return null;
}

async function renderTwoConsumersUnderSameProvider() {
  const boxA: Box = { value: null };
  const boxB: Box = { value: null };
  await render(
    React.createElement(
      ContigoHabitsProvider,
      null,
      React.createElement(Consumer, { box: boxA }),
      React.createElement(Consumer, { box: boxB }),
    ),
  );
  return { boxA, boxB };
}

describe('ContigoHabitsProvider — un solo dueño del mapa de hábitos', () => {
  it('dos consumidores bajo el mismo provider no se pisan entre sí (el bug original)', async () => {
    const { boxA, boxB } = await renderTwoConsumersUnderSameProvider();

    await act(async () => {
      await boxA.value!.setReadingDone(TODAY, true);
    });
    await act(async () => {
      await boxB.value!.setRevisionDone(TODAY, true);
    });

    const stored = JSON.parse(
      (await AsyncStorage.getItem(STORAGE_KEY)) as string,
    );
    expect(stored[TODAY].readingDone).toBe(true);
    expect(stored[TODAY].revisionDone).toBe(true);
  });

  it('dos llamadas rápidas seguidas desde el mismo consumidor persisten ambas', async () => {
    const { boxA } = await renderTwoConsumersUnderSameProvider();

    await act(async () => {
      await Promise.all([
        boxA.value!.setReadingDone(TODAY, true),
        boxA.value!.setRevisionDone(TODAY, true),
      ]);
    });

    const stored = JSON.parse(
      (await AsyncStorage.getItem(STORAGE_KEY)) as string,
    );
    expect(stored[TODAY].readingDone).toBe(true);
    expect(stored[TODAY].revisionDone).toBe(true);
  });

  it('la hidratación inicial lee el formato actual de @contigo_habits tal cual', async () => {
    const fixture = {
      '2026-08-01': {
        date: '2026-08-01',
        readingDone: true,
        prayerDone: false,
        timestamp: 1,
      },
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fixture));

    const { boxA } = await renderTwoConsumersUnderSameProvider();

    expect(boxA.value!.getRecord('2026-08-01')).toEqual(fixture['2026-08-01']);
  });

  it('lanza si se usa fuera del provider', async () => {
    await expect(
      render(React.createElement(Consumer, { box: { value: null } })),
    ).rejects.toThrow(/dentro de ContigoHabitsProvider/);
  });
});

describe('setPrayerDone', () => {
  it('guarda duración y emoción', async () => {
    const { boxA } = await renderTwoConsumersUnderSameProvider();
    await act(async () => {
      await boxA.value!.setPrayerDone(TODAY, '5_to_10', 'joy', 8);
    });
    const record = boxA.value!.getRecord(TODAY);
    expect(record).toMatchObject({
      prayerDone: true,
      prayerDuration: '5_to_10',
      prayerDurationMinutes: 8,
      prayerEmotion: 'joy',
    });
  });

  it('sin emoción (null) no deja `prayerEmotion` puesto', async () => {
    const { boxA } = await renderTwoConsumersUnderSameProvider();
    await act(async () => {
      await boxA.value!.setPrayerDone(TODAY, 'less_than_1', null);
    });
    expect(boxA.value!.getRecord(TODAY)?.prayerEmotion).toBeUndefined();
  });
});

describe('isRevisionDone', () => {
  it('refleja revisionDone del día', async () => {
    const { boxA } = await renderTwoConsumersUnderSameProvider();
    expect(boxA.value!.isRevisionDone(TODAY)).toBe(false);
    await act(async () => {
      await boxA.value!.setRevisionDone(TODAY, true);
    });
    expect(boxA.value!.isRevisionDone(TODAY)).toBe(true);
  });
});

describe('reloadRecords', () => {
  it('vuelve a leer AsyncStorage (recoge cambios de otra pantalla)', async () => {
    const { boxA } = await renderTwoConsumersUnderSameProvider();
    expect(boxA.value!.getRecord(TODAY)).toBeNull();

    // Otra pantalla escribe directamente en AsyncStorage sin pasar por este
    // provider (simulado aquí como una escritura externa cruda).
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [TODAY]: {
          date: TODAY,
          readingDone: true,
          prayerDone: false,
          timestamp: 1,
        },
      }),
    );

    await act(async () => {
      boxA.value!.reloadRecords();
    });
    expect(boxA.value!.getRecord(TODAY)?.readingDone).toBe(true);
  });
});

describe('estadísticas derivadas (usando el todayStr real del context)', () => {
  function daysBefore(base: string, n: number): string {
    const [y, m, d] = base.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - n);
    return [
      dt.getFullYear(),
      String(dt.getMonth() + 1).padStart(2, '0'),
      String(dt.getDate()).padStart(2, '0'),
    ].join('-');
  }

  it('getStreak cuenta días consecutivos hasta hoy', async () => {
    const { boxA } = await renderTwoConsumersUnderSameProvider();
    const today = boxA.value!.todayStr;
    await act(async () => {
      await boxA.value!.setReadingDone(today, true);
      await boxA.value!.setReadingDone(daysBefore(today, 1), true);
      await boxA.value!.setReadingDone(daysBefore(today, 2), true);
    });
    expect(boxA.value!.getStreak('reading')).toBe(3);
  });

  it('getStreak no rompe la racha si solo falta HOY (aún no marcado)', async () => {
    const { boxA } = await renderTwoConsumersUnderSameProvider();
    const today = boxA.value!.todayStr;
    await act(async () => {
      await boxA.value!.setReadingDone(daysBefore(today, 1), true);
      await boxA.value!.setReadingDone(daysBefore(today, 2), true);
    });
    expect(boxA.value!.getStreak('reading')).toBe(2);
  });

  it('getStreak se corta si falta un día que no sea hoy', async () => {
    const { boxA } = await renderTwoConsumersUnderSameProvider();
    const today = boxA.value!.todayStr;
    await act(async () => {
      await boxA.value!.setReadingDone(today, true);
      // daysBefore(today, 1) queda sin marcar → corta la racha.
      await boxA.value!.setReadingDone(daysBefore(today, 2), true);
    });
    expect(boxA.value!.getStreak('reading')).toBe(1);
  });

  it('getTotalMinutesWeek suma solo lo marcado en la semana hasta hoy', async () => {
    const { boxA } = await renderTwoConsumersUnderSameProvider();
    const today = boxA.value!.todayStr;
    await act(async () => {
      await boxA.value!.setPrayerDone(today, '5_to_10', 'joy', 8);
    });
    expect(boxA.value!.getTotalMinutesWeek(today)).toBe(8);
  });

  it('getReadingsMonth y getActiveDaysMonth cuentan el día marcado', async () => {
    const { boxA } = await renderTwoConsumersUnderSameProvider();
    const today = boxA.value!.todayStr;
    await act(async () => {
      await boxA.value!.setReadingDone(today, true);
    });
    expect(boxA.value!.getReadingsMonth(today)).toBe(1);
    expect(boxA.value!.getActiveDaysMonth(today)).toBe(1);
  });
});

describe('hidratación remota (multi-dispositivo)', () => {
  it('sin sesión, no llama a fetchContigoHabits', async () => {
    await renderTwoConsumersUnderSameProvider();
    expect(fetchContigoHabits).not.toHaveBeenCalled();
  });

  it('con sesión pero sin nada remoto, no persiste de más ni resincroniza', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { uid: 'u1' } });
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [TODAY]: { date: TODAY, readingDone: true, prayerDone: false, timestamp: 1 },
      }),
    );
    const { boxA } = await renderTwoConsumersUnderSameProvider();
    expect(fetchContigoHabits).toHaveBeenCalledWith('u1');
    expect(syncContigoHabit).not.toHaveBeenCalled();
    expect(boxA.value!.getRecord(TODAY)?.readingDone).toBe(true);
  });

  it('fusiona lo remoto con lo local y re-sincroniza lo que solo estaba local', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { uid: 'u1' } });
    const localOnly = {
      date: '2026-08-01',
      readingDone: true,
      prayerDone: false,
      timestamp: 1,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ '2026-08-01': localOnly }));
    (fetchContigoHabits as jest.Mock).mockResolvedValue({
      '2026-08-02': {
        date: '2026-08-02',
        readingDone: false,
        prayerDone: true,
        timestamp: 2,
      },
    });

    const { boxA } = await renderTwoConsumersUnderSameProvider();

    expect(boxA.value!.getRecord('2026-08-01')).toEqual(localOnly);
    expect(boxA.value!.getRecord('2026-08-02')?.prayerDone).toBe(true);
    // Solo el 08-01 era exclusivamente local → es el que hay que re-subir.
    expect(syncContigoHabit).toHaveBeenCalledWith('u1', '2026-08-01', localOnly);
    expect(syncContigoHabit).not.toHaveBeenCalledWith(
      'u1',
      '2026-08-02',
      expect.anything(),
    );

    const stored = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) as string);
    expect(stored['2026-08-01']).toEqual(localOnly);
    expect(stored['2026-08-02']).toBeDefined();
  });
});

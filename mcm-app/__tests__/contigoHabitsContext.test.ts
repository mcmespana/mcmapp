/**
 * Test de regresión del Plan 004: antes cada pantalla de Contigo montaba su
 * propia instancia de `useContigoHabits` con su propio `records` en el
 * closure. Si dos pantallas escribían sin remontarse entre medias, la
 * segunda pisaba el mapa entero con su copia vieja y el cambio de la
 * primera desaparecía. Con `ContigoHabitsProvider` como único dueño del
 * estado, dos consumidores bajo el MISMO provider comparten `records` y
 * ninguna escritura se pierde.
 */
import React from 'react';
import { render, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ContigoHabitsProvider,
  useContigoHabitsContext,
  type ContigoHabitsContextValue,
} from '@/contexts/ContigoHabitsContext';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

const STORAGE_KEY = '@contigo_habits';
const TODAY = '2026-08-06';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
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
});

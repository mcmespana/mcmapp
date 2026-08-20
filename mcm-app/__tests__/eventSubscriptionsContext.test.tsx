/**
 * Tests de `EventSubscriptionsContext` (suscripciones opt-in a eventos como
 * el Jubileo o encuentros): qué topics `event-<id>` se derivan para el push,
 * que un JSON corrupto o con el shape equivocado no tumbe el arranque, y la
 * idempotencia de subscribe/markPrompted (evitar duplicados en el array
 * persistido).
 */
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  EventSubscriptionsProvider,
  useEventSubscriptions,
  eventTopic,
} from '@/contexts/EventSubscriptionsContext';

const SUBS_KEY = '@event_subscriptions';
const PROMPTED_KEY = '@event_subscription_prompts';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <EventSubscriptionsProvider>{children}</EventSubscriptionsProvider>
);

async function mount() {
  const hook = await renderHook(() => useEventSubscriptions(), { wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('eventTopic', () => {
  it('antepone "event-" al id', () => {
    expect(eventTopic('jubileo2025')).toBe('event-jubileo2025');
  });
});

describe('carga inicial', () => {
  it('arranca sin suscripciones ni prompts', async () => {
    const { result } = await mount();
    expect(result.current.subscribedEventIds).toEqual([]);
    expect(result.current.eventTopics).toEqual([]);
  });

  it('recupera las suscripciones guardadas', async () => {
    await AsyncStorage.setItem(
      SUBS_KEY,
      JSON.stringify(['jubileo2025', 'encuentro-verano']),
    );
    const { result } = await mount();
    expect(result.current.subscribedEventIds).toEqual([
      'jubileo2025',
      'encuentro-verano',
    ]);
    expect(result.current.eventTopics).toEqual([
      'event-jubileo2025',
      'event-encuentro-verano',
    ]);
  });

  it('descarta del array guardado los elementos que no son string', async () => {
    await AsyncStorage.setItem(
      SUBS_KEY,
      JSON.stringify(['valido', 42, null, { id: 'x' }]),
    );
    const { result } = await mount();
    expect(result.current.subscribedEventIds).toEqual(['valido']);
  });

  it('ignora el JSON guardado si no es un array (shape inesperado)', async () => {
    await AsyncStorage.setItem(SUBS_KEY, JSON.stringify({ foo: 'bar' }));
    const { result } = await mount();
    expect(result.current.subscribedEventIds).toEqual([]);
  });

  it('no revienta con JSON corrupto y arranca con los defaults', async () => {
    await AsyncStorage.setItem(SUBS_KEY, '{{{no-json');
    const { result } = await mount();
    expect(result.current.subscribedEventIds).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('recupera los prompts ya mostrados', async () => {
    await AsyncStorage.setItem(PROMPTED_KEY, JSON.stringify(['jubileo2025']));
    const { result } = await mount();
    expect(result.current.wasPrompted('jubileo2025')).toBe(true);
    expect(result.current.wasPrompted('otro-evento')).toBe(false);
  });
});

describe('subscribe / unsubscribe / toggle', () => {
  it('subscribe añade el id y persiste', async () => {
    const { result } = await mount();
    await act(async () => result.current.subscribe('jubileo2025'));
    expect(result.current.isSubscribed('jubileo2025')).toBe(true);
    await waitFor(async () => {
      const raw = await AsyncStorage.getItem(SUBS_KEY);
      expect(JSON.parse(raw!)).toEqual(['jubileo2025']);
    });
  });

  it('subscribe es idempotente: suscribirse dos veces no duplica', async () => {
    const { result } = await mount();
    await act(async () => result.current.subscribe('jubileo2025'));
    await act(async () => result.current.subscribe('jubileo2025'));
    expect(result.current.subscribedEventIds).toEqual(['jubileo2025']);
  });

  it('unsubscribe quita el id', async () => {
    await AsyncStorage.setItem(SUBS_KEY, JSON.stringify(['jubileo2025']));
    const { result } = await mount();
    await act(async () => result.current.unsubscribe('jubileo2025'));
    expect(result.current.isSubscribed('jubileo2025')).toBe(false);
  });

  it('unsubscribe de un id no suscrito no hace nada', async () => {
    const { result } = await mount();
    await act(async () => result.current.unsubscribe('no-existe'));
    expect(result.current.subscribedEventIds).toEqual([]);
  });

  it('toggle activa y desactiva alternando', async () => {
    const { result } = await mount();
    await act(async () => result.current.toggle('jubileo2025'));
    expect(result.current.isSubscribed('jubileo2025')).toBe(true);
    await act(async () => result.current.toggle('jubileo2025'));
    expect(result.current.isSubscribed('jubileo2025')).toBe(false);
  });
});

describe('markPrompted', () => {
  it('marca el evento como ya sugerido y persiste', async () => {
    const { result } = await mount();
    await act(async () => result.current.markPrompted('jubileo2025'));
    expect(result.current.wasPrompted('jubileo2025')).toBe(true);
    await waitFor(async () => {
      const raw = await AsyncStorage.getItem(PROMPTED_KEY);
      expect(JSON.parse(raw!)).toEqual(['jubileo2025']);
    });
  });

  it('markPrompted es idempotente', async () => {
    const { result } = await mount();
    await act(async () => result.current.markPrompted('jubileo2025'));
    await act(async () => result.current.markPrompted('jubileo2025'));
    expect(
      result.current.subscribedEventIds.length === 0 &&
        result.current.wasPrompted('jubileo2025'),
    ).toBe(true);
  });
});

describe('fuera del provider (SSG)', () => {
  it('devuelve defaults sin reventar', async () => {
    const { result } = await renderHook(() => useEventSubscriptions());
    expect(result.current.loading).toBe(true);
    expect(result.current.subscribedEventIds).toEqual([]);
    expect(result.current.isSubscribed('x')).toBe(false);
    expect(() => result.current.subscribe('x')).not.toThrow();
    expect(() => result.current.toggle('x')).not.toThrow();
    expect(() => result.current.markPrompted('x')).not.toThrow();
  });
});

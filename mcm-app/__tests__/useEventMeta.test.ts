/**
 * Tests de `hooks/useEventMeta.ts`.
 *
 * Este hook es lo que hace que archivar, renombrar o recolorear un evento
 * desde el panel se note en la app (B1). Dos cosas concretas que se rompen sin
 * dar error: que la caché local no se pinte al instante (la app parece vacía
 * al abrir sin red), y que el efecto entre en bucle porque `eventIds` es un
 * array nuevo en cada render — de ahí la clave estable interna.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { get } from 'firebase/database';
import { useEventsMeta, useEventMeta } from '@/hooks/useEventMeta';

jest.mock('@/utils/firebaseApp', () => ({ getFirebaseApp: () => ({}) }));

const mGet = get as unknown as jest.Mock;

const snap = (value: unknown) => ({
  exists: () => value !== null && value !== undefined,
  val: () => value,
});

const META = {
  status: 'archived',
  title: 'Jubileo 2025',
  tintColor: '#123456',
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('useEventsMeta', () => {
  it('sin ids no consulta nada', async () => {
    const { result } = await renderHook(() => useEventsMeta([]));
    expect(result.current).toEqual({});
    expect(mGet).not.toHaveBeenCalled();
  });

  it('ignora los ids vacíos', async () => {
    await renderHook(() => useEventsMeta(['', undefined as never]));
    expect(mGet).not.toHaveBeenCalled();
  });

  it('descarga el _meta de cada evento y lo cachea', async () => {
    mGet.mockResolvedValue(snap(META));
    const { result } = await renderHook(() =>
      useEventsMeta(['jubileo', 'visitapapa']),
    );
    await waitFor(() =>
      expect(Object.keys(result.current).sort()).toEqual([
        'jubileo',
        'visitapapa',
      ]),
    );
    expect(result.current.jubileo).toEqual(META);
    await waitFor(async () =>
      expect(await AsyncStorage.getItem('eventMeta_jubileo')).toBe(
        JSON.stringify(META),
      ),
    );
  });

  it('pinta la caché local antes de que conteste Firebase', async () => {
    await AsyncStorage.setItem('eventMeta_jubileo', JSON.stringify(META));
    // Firebase nunca contesta en este test.
    mGet.mockReturnValue(new Promise(() => {}));
    const { result } = await renderHook(() => useEventsMeta(['jubileo']));
    await waitFor(() => expect(result.current.jubileo).toEqual(META));
  });

  it('una caché corrupta no impide el fetch remoto', async () => {
    await AsyncStorage.setItem('eventMeta_jubileo', '{roto');
    mGet.mockResolvedValue(snap(META));
    const { result } = await renderHook(() => useEventsMeta(['jubileo']));
    await waitFor(() => expect(result.current.jubileo).toEqual(META));
  });

  it('ignora el literal "undefined" guardado en caché', async () => {
    await AsyncStorage.setItem('eventMeta_jubileo', 'undefined');
    mGet.mockResolvedValue(snap(null));
    const { result } = await renderHook(() => useEventsMeta(['jubileo']));
    await waitFor(() => expect(mGet).toHaveBeenCalled());
    expect(result.current.jubileo).toBeUndefined();
  });

  it('si el nodo no existe, el evento no aparece en el mapa', async () => {
    mGet.mockResolvedValue(snap(null));
    const { result } = await renderHook(() => useEventsMeta(['jubileo']));
    await waitFor(() => expect(mGet).toHaveBeenCalled());
    expect(result.current).toEqual({});
  });

  it('un error de red no rompe el hook', async () => {
    mGet.mockRejectedValue(new Error('offline'));
    const { result } = await renderHook(() => useEventsMeta(['jubileo']));
    await waitFor(() => expect(mGet).toHaveBeenCalled());
    expect(result.current).toEqual({});
  });

  it('no vuelve a consultar si el array cambia de identidad pero no de contenido', async () => {
    mGet.mockResolvedValue(snap(META));
    const { rerender } = await renderHook(
      ({ ids }: { ids: string[] }) => useEventsMeta(ids),
      { initialProps: { ids: ['jubileo'] } },
    );
    await waitFor(() => expect(mGet).toHaveBeenCalledTimes(1));
    // `rerender` es asíncrono en esta versión de RNTL: sin `await act` la cola
    // de React queda a medias y el siguiente test monta en falso.
    await act(async () => rerender({ ids: ['jubileo'] }));
    await act(async () => rerender({ ids: ['jubileo'] }));
    expect(mGet).toHaveBeenCalledTimes(1);
  });

  it('deduplica ids repetidos', async () => {
    mGet.mockResolvedValue(snap(META));
    await renderHook(() => useEventsMeta(['jubileo', 'jubileo']));
    await waitFor(() => expect(mGet).toHaveBeenCalledTimes(1));
  });
});

describe('useEventMeta (un solo evento)', () => {
  it('devuelve null sin evento', async () => {
    const { result } = await renderHook(() => useEventMeta(null));
    expect(result.current).toBeNull();
  });

  it('devuelve el meta del evento pedido', async () => {
    mGet.mockResolvedValue(snap(META));
    const { result } = await renderHook(() => useEventMeta('jubileo'));
    await waitFor(() => expect(result.current).toEqual(META));
  });

  it('devuelve null si el evento no tiene _meta', async () => {
    mGet.mockResolvedValue(snap(null));
    const { result } = await renderHook(() => useEventMeta('jubileo'));
    await waitFor(() => expect(mGet).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });
});

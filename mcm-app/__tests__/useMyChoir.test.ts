/**
 * Tests de `useMyChoir`: el coro que este dispositivo tiene elegido.
 * Lo importante: solo se acepta un id de coro con forma válida
 * (`isChoirId`), y guardar/quitar persiste en AsyncStorage para que la
 * elección sobreviva a cerrar la app.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMyChoir } from '@/hooks/useMyChoir';

const STORAGE_KEY = '@mcm_my_choir_v1';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('hidratación', () => {
  it('arranca sin coro y termina hidratado', async () => {
    const { result } = await renderHook(() => useMyChoir());
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    expect(result.current.choir).toBeNull();
  });

  it('recupera el coro guardado', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ id: 'consolacion-castellon-4f2a', name: 'Castellón' }),
    );
    const { result } = await renderHook(() => useMyChoir());
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    expect(result.current.choir).toEqual({
      id: 'consolacion-castellon-4f2a',
      name: 'Castellón',
    });
  });

  it('ignora un id guardado con forma inválida', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ id: 'no-es-un-choir-id-valido!', name: 'Raro' }),
    );
    const { result } = await renderHook(() => useMyChoir());
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    expect(result.current.choir).toBeNull();
  });

  it('usa el id como nombre si no venía name guardado', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ id: 'consolacion-castellon-4f2a' }),
    );
    const { result } = await renderHook(() => useMyChoir());
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    expect(result.current.choir?.name).toBe('consolacion-castellon-4f2a');
  });

  it('no revienta con JSON corrupto', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'no-json');
    const { result } = await renderHook(() => useMyChoir());
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    expect(result.current.choir).toBeNull();
  });
});

describe('setChoir', () => {
  it('guarda el coro elegido y lo persiste', async () => {
    const { result } = await renderHook(() => useMyChoir());
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    await act(async () =>
      result.current.setChoir({ id: 'coro-1', name: 'Coro Uno' }),
    );
    expect(result.current.choir).toEqual({ id: 'coro-1', name: 'Coro Uno' });
    await waitFor(async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      expect(JSON.parse(raw!)).toEqual({ id: 'coro-1', name: 'Coro Uno' });
    });
  });

  it('null quita el coro elegido y lo borra de AsyncStorage', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ id: 'coro-1', name: 'Coro Uno' }),
    );
    const { result } = await renderHook(() => useMyChoir());
    await waitFor(() => expect(result.current.choir).not.toBeNull());
    await act(async () => result.current.setChoir(null));
    expect(result.current.choir).toBeNull();
    await waitFor(async () => {
      expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });
});

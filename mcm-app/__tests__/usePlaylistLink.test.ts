/**
 * Tests de `usePlaylistLink`: el enlace entre la playlist local y su copia
 * en la nube (código + firma + si la subiste tú). Lo importante:
 *
 *  - Migra la clave legacy (`@mcm_last_upload_code`, solo un código) al
 *    formato nuevo, asumiendo que era tuya (`owned: true`) y con firma vacía
 *    (fuerza a "cambios sin guardar" hasta la primera sincronización real).
 *  - La clave legacy se borra tras migrar, para no reprocesarla cada arranque.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePlaylistLink } from '@/hooks/usePlaylistLink';

const STORAGE_KEY = '@mcm_playlist_link_v1';
const LEGACY_CODE_KEY = '@mcm_last_upload_code';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('hidratación', () => {
  it('arranca sin link', async () => {
    const { result } = await renderHook(() => usePlaylistLink());
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    expect(result.current.link).toBeNull();
  });

  it('recupera el link guardado en el formato actual', async () => {
    const link = {
      code: '1234',
      name: 'Domingo',
      signature: 'sig1',
      syncedAt: 1000,
      owned: true,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(link));
    const { result } = await renderHook(() => usePlaylistLink());
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    expect(result.current.link).toEqual(link);
  });

  it('ignora un código guardado con forma inválida', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ code: 'no-valido', signature: '', syncedAt: 0, owned: true }),
    );
    const { result } = await renderHook(() => usePlaylistLink());
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    expect(result.current.link).toBeNull();
  });

  it('no revienta con JSON corrupto', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'no-json');
    const { result } = await renderHook(() => usePlaylistLink());
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    expect(result.current.link).toBeNull();
  });

  it('migra la clave legacy asumiendo que era tuya, con firma vacía', async () => {
    await AsyncStorage.setItem(LEGACY_CODE_KEY, '5678');
    const { result } = await renderHook(() => usePlaylistLink());
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    expect(result.current.link).toEqual({
      code: '5678',
      signature: '',
      syncedAt: 0,
      owned: true,
    });
    expect(await AsyncStorage.getItem(LEGACY_CODE_KEY)).toBeNull();
  });

  it('ignora y borra una clave legacy con código inválido', async () => {
    await AsyncStorage.setItem(LEGACY_CODE_KEY, 'no-valido');
    const { result } = await renderHook(() => usePlaylistLink());
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    expect(result.current.link).toBeNull();
    expect(await AsyncStorage.getItem(LEGACY_CODE_KEY)).toBeNull();
  });

  it('si ya hay link en el formato actual, no mira la clave legacy', async () => {
    await AsyncStorage.setItem(LEGACY_CODE_KEY, '9999');
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ code: '1234', signature: 's', syncedAt: 1, owned: true }),
    );
    const { result } = await renderHook(() => usePlaylistLink());
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    expect(result.current.link?.code).toBe('1234');
  });
});

describe('setLink', () => {
  it('guarda el link y lo persiste', async () => {
    const { result } = await renderHook(() => usePlaylistLink());
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    const link = {
      code: '1234',
      signature: 'sig1',
      syncedAt: 1000,
      owned: true,
    };
    await act(async () => result.current.setLink(link));
    expect(result.current.link).toEqual(link);
    await waitFor(async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      expect(JSON.parse(raw!)).toEqual(link);
    });
  });

  it('null quita el link y lo borra de AsyncStorage', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ code: '1234', signature: '', syncedAt: 0, owned: true }),
    );
    const { result } = await renderHook(() => usePlaylistLink());
    await waitFor(() => expect(result.current.link).not.toBeNull());
    await act(async () => result.current.setLink(null));
    expect(result.current.link).toBeNull();
    await waitFor(async () => {
      expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });
});

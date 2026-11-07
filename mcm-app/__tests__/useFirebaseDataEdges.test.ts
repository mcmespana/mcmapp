/**
 * useFirebaseData — los caminos que no dan error visible cuando se rompen.
 *
 * Todos acaban igual si fallan: la pantalla enseña datos viejos (o nada) y
 * nadie se entera. Una sección que el panel ocultó sigue visible, una caché
 * corrupta deja la pantalla vacía para siempre, la app que arrancó sin red no
 * se revalida al recuperarla, o un fallo de reglas se reintenta y se registra
 * dos veces en Sentry.
 *
 * Lo básico (descarga, caché, transform, coalescencia) está en
 * `useFirebaseData.test.ts`; los reintentos de red, en `firebaseRetry.test.ts`.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import {
  useFirebaseData,
  withRetry,
  __resetNodeCacheForTests,
} from '@/hooks/useFirebaseData';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { get } from 'firebase/database';
import { __setMockNode, __resetMockDb } from '@/__mocks__/firebase';
import {
  __setNetworkState,
  __triggerNetworkChange,
} from '@/__mocks__/expo-network';
import { logger } from '@/utils/logger';
import { __resetPermissionReportsForTests } from '@/utils/firebaseErrors';

const getCallsFor = (suffix: string) =>
  (get as jest.Mock).mock.calls.filter(
    (c) => String(c[0]?.path ?? '') === suffix,
  ).length;

let errorSpy: jest.SpyInstance;

beforeEach(async () => {
  jest.clearAllMocks();
  __resetMockDb();
  await AsyncStorage.clear();
  __resetNodeCacheForTests();
  __resetPermissionReportsForTests();
  __setNetworkState({ isConnected: true, isInternetReachable: true });
  errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
  jest.spyOn(logger, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useFirebaseData — sin nodo (path null)', () => {
  it('no pregunta nada a Firebase y no se queda cargando para siempre', async () => {
    const { result } = await renderHook(() =>
      useFirebaseData<unknown>(null, 'noop_key'),
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });
});

describe('useFirebaseData — hidden', () => {
  it('lee hidden:true del nodo y lo persiste para el arranque offline', async () => {
    __setMockNode('sec_hidden', { updatedAt: 1, data: { a: 1 }, hidden: true });
    const { result } = await renderHook(() =>
      useFirebaseData('sec_hidden', 'sec_hidden_key'),
    );
    await waitFor(() => expect(result.current.hidden).toBe(true));
    expect(await AsyncStorage.getItem('sec_hidden_key_hidden')).toBe('true');
  });

  it('si el panel vuelve a mostrar la sección, la caché "hidden" no la deja escondida', async () => {
    await AsyncStorage.setItem('sec_back_key_data', '{"a":1}');
    await AsyncStorage.setItem('sec_back_key_updatedAt', '7');
    await AsyncStorage.setItem('sec_back_key_hidden', 'true');
    // Mismo updatedAt → no se descarga `data`, pero `hidden` sí se relee.
    __setMockNode('sec_back', { updatedAt: 7, data: { a: 1 } });

    const { result } = await renderHook(() =>
      useFirebaseData('sec_back', 'sec_back_key'),
    );
    await waitFor(() => expect(getCallsFor('sec_back/hidden')).toBe(1));
    await waitFor(() => expect(result.current.hidden).toBe(false));
    expect(result.current.data).toEqual({ a: 1 });
    expect(getCallsFor('sec_back/data')).toBe(0);
  });

  it('hidden solo cuenta si es exactamente true (un "true" en texto no esconde)', async () => {
    __setMockNode('sec_str', { updatedAt: 1, data: { a: 1 }, hidden: 'true' });
    const { result } = await renderHook(() =>
      useFirebaseData('sec_str', 'sec_str_key'),
    );
    await waitFor(() => expect(result.current.data).toEqual({ a: 1 }));
    expect(result.current.hidden).toBe(false);
  });
});

describe('useFirebaseData — caché local', () => {
  it('una caché con JSON corrupto se descarta y se sirve lo que hay en Firebase', async () => {
    await AsyncStorage.setItem('corrupt_key_data', '{roto');
    await AsyncStorage.setItem('corrupt_key_updatedAt', '3');
    __setMockNode('corrupt', { updatedAt: 3, data: { ok: true } });

    const { result } = await renderHook(() =>
      useFirebaseData('corrupt', 'corrupt_key'),
    );
    // Aunque el updatedAt coincida, al descartar la caché hay que descargar.
    await waitFor(() => expect(result.current.data).toEqual({ ok: true }));
    expect(await AsyncStorage.getItem('corrupt_key_data')).toBe('{"ok":true}');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('la cadena "undefined" guardada por web no se toma por caché válida', async () => {
    await AsyncStorage.setItem('undef_key_data', 'undefined');
    await AsyncStorage.setItem('undef_key_updatedAt', '3');
    __setMockNode('undef', { updatedAt: 3, data: [1, 2] });

    const { result } = await renderHook(() =>
      useFirebaseData('undef', 'undef_key'),
    );
    await waitFor(() => expect(result.current.data).toEqual([1, 2]));
  });

  it('con caché válida y un nodo sin updatedAt, no se descarga `data` en cada montaje', async () => {
    await AsyncStorage.setItem('nometa_key_data', '{"v":"local"}');
    await AsyncStorage.setItem('nometa_key_updatedAt', '9');
    __setMockNode('nometa', { data: { v: 'remoto' } });

    const { result } = await renderHook(() =>
      useFirebaseData('nometa', 'nometa_key'),
    );
    await waitFor(() => expect(getCallsFor('nometa/updatedAt')).toBe(1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ v: 'local' });
    expect(getCallsFor('nometa/data')).toBe(0);
  });

  it('caché sin updatedAt guardado: descarga para no quedarse con datos de versión desconocida', async () => {
    await AsyncStorage.setItem('nots_key_data', '{"v":"viejo"}');
    __setMockNode('nots', { updatedAt: 4, data: { v: 'nuevo' } });

    const { result } = await renderHook(() =>
      useFirebaseData('nots', 'nots_key'),
    );
    await waitFor(() => expect(result.current.data).toEqual({ v: 'nuevo' }));
    expect(await AsyncStorage.getItem('nots_key_updatedAt')).toBe('4');
  });
});

describe('useFirebaseData — red', () => {
  it('isInternetReachable=false cuenta como offline aunque haya wifi (portal cautivo)', async () => {
    __setNetworkState({ isConnected: true, isInternetReachable: false });
    __setMockNode('captive', { updatedAt: 1, data: 1 });
    const { result } = await renderHook(() =>
      useFirebaseData('captive', 'captive_key'),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.offline).toBe(true);
  });

  it('isInternetReachable=null (aún sin saber) NO se trata como offline', async () => {
    __setNetworkState({
      isConnected: true,
      isInternetReachable: null as unknown as boolean,
    });
    __setMockNode('unknown_reach', { updatedAt: 1, data: 1 });
    const { result } = await renderHook(() =>
      useFirebaseData('unknown_reach', 'unknown_reach_key'),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.offline).toBe(false);
  });

  it('al recuperar la red se revalida sola, sin volver a montar la pantalla', async () => {
    __setNetworkState({ isConnected: false, isInternetReachable: false });
    // Sin red, Firebase no contesta: la primera carga se queda sin datos.
    (get as jest.Mock).mockRejectedValue(new Error('offline'));
    jest.useFakeTimers();
    const { result } = await renderHook(() =>
      useFirebaseData('resync', 'resync_key'),
    );
    await act(async () => {
      await jest.runAllTimersAsync();
    });
    jest.useRealTimers();
    expect(result.current.offline).toBe(true);
    expect(result.current.data).toBeNull();

    __resetMockDb();
    __setMockNode('resync', { updatedAt: 2, data: { vuelta: true } });
    __setNetworkState({ isConnected: true, isInternetReachable: true });
    await act(async () => {
      __triggerNetworkChange();
    });

    await waitFor(() => expect(result.current.data).toEqual({ vuelta: true }));
    expect(result.current.offline).toBe(false);
  });

  it('un cambio wifi → datos estando ya conectado no dispara otra descarga', async () => {
    __setMockNode('steady', { updatedAt: 1, data: { a: 1 } });
    const { result } = await renderHook(() =>
      useFirebaseData('steady', 'steady_key'),
    );
    await waitFor(() => expect(result.current.data).toEqual({ a: 1 }));
    const before = getCallsFor('steady/updatedAt');

    await act(async () => {
      __triggerNetworkChange();
    });
    expect(getCallsFor('steady/updatedAt')).toBe(before);
  });
});

describe('useFirebaseData — reglas', () => {
  const denied = Object.assign(new Error('permission_denied at /x'), {
    code: 'PERMISSION_DENIED',
  });

  it('una denegación de reglas no se reintenta: una sola petición por hijo', async () => {
    (get as jest.Mock).mockRejectedValue(denied);
    const { result } = await renderHook(() =>
      useFirebaseData('closed', 'closed_key'),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getCallsFor('closed/updatedAt')).toBe(1);
  });

  it('la denegación se reporta una vez, con su path, y no se duplica como error genérico', async () => {
    (get as jest.Mock).mockRejectedValue(denied);
    const { result } = await renderHook(() =>
      useFirebaseData('closed2', 'closed2_key'),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    const messages = errorSpy.mock.calls.map((c) => String(c[0]));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('[firebase-rules]');
    expect(messages[0]).toContain('"closed2"');
  });

  it('withRetry sin contexto trata la denegación como un fallo más (compatibilidad)', async () => {
    jest.useFakeTimers();
    const run = jest.fn().mockRejectedValue(denied);
    const settled = withRetry(run).catch((e) => e);
    await jest.runAllTimersAsync();
    expect(await settled).toBe(denied);
    expect(run).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });
});

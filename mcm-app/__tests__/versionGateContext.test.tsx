/**
 * Tests de `VersionGateContext`: la pantalla de actualización obligatoria.
 * `isAppVersionSupported` (el semver puro) ya está testeado en
 * `resolveProfileConfig.test.ts`; aquí se testea la orquestación: que
 * `updateRequired` reaccione al `minAppVersion` resuelto, que "saltar" el
 * aviso sea solo de esta sesión, y que abrir la tienda delegue en
 * `openAppStore`.
 */
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import { openAppStore } from '@/utils/storeLinks';
import {
  VersionGateProvider,
  useVersionGate,
} from '@/contexts/VersionGateContext';

jest.mock('@/hooks/useResolvedProfileConfig', () => ({
  useResolvedProfileConfig: jest.fn(),
}));
jest.mock('@/utils/storeLinks', () => ({
  openAppStore: jest.fn(),
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '2.1.0' } },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <VersionGateProvider>{children}</VersionGateProvider>
);

async function mount() {
  return renderHook(() => useVersionGate(), { wrapper });
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  (useResolvedProfileConfig as jest.Mock).mockReturnValue({
    minAppVersion: '0.0.0',
  });
});

describe('updateRequired', () => {
  it('sin minAppVersion (0.0.0), no bloquea', async () => {
    const { result } = await mount();
    expect(result.current.updateRequired).toBe(false);
    expect(result.current.currentVersion).toBe('2.1.0');
  });

  it('con minAppVersion por debajo de la instalada, no bloquea', async () => {
    (useResolvedProfileConfig as jest.Mock).mockReturnValue({
      minAppVersion: '2.0.0',
    });
    const { result } = await mount();
    expect(result.current.updateRequired).toBe(false);
  });

  it('con minAppVersion por encima de la instalada, bloquea', async () => {
    (useResolvedProfileConfig as jest.Mock).mockReturnValue({
      minAppVersion: '3.0.0',
    });
    const { result } = await mount();
    expect(result.current.updateRequired).toBe(true);
    expect(result.current.minAppVersion).toBe('3.0.0');
  });
});

describe('skipUpdate', () => {
  it('marca el aviso como saltado', async () => {
    (useResolvedProfileConfig as jest.Mock).mockReturnValue({
      minAppVersion: '3.0.0',
    });
    const { result } = await mount();
    expect(result.current.updateSkipped).toBe(false);
    await act(async () => result.current.skipUpdate());
    expect(result.current.updateSkipped).toBe(true);
    // "Saltado" no significa "ya no hace falta actualizar": sigue vigente,
    // solo se deja de insistir en esta sesión.
    expect(result.current.updateRequired).toBe(true);
  });
});

describe('límite de «Ahora no» (minAppVersionSkips)', () => {
  const block = (skips?: number) =>
    (useResolvedProfileConfig as jest.Mock).mockReturnValue({
      minAppVersion: '3.0.0',
      minAppVersionSkips: skips,
    });

  it('sin límite (ausente): siempre se puede saltar, lo de siempre', async () => {
    block(undefined);
    const { result } = await mount();
    expect(result.current.canSkip).toBe(true);
    expect(result.current.skipsLeft).toBeNull();
  });

  it('0 = estricto: no se puede saltar y skipUpdate no hace nada', async () => {
    block(0);
    const { result } = await mount();
    await waitFor(() => expect(result.current.skipsLeft).toBe(0));
    expect(result.current.canSkip).toBe(false);
    await act(async () => result.current.skipUpdate());
    expect(result.current.updateSkipped).toBe(false);
  });

  it('con N saltos: gasta uno cada vez y a la N+1 ya es estricto', async () => {
    block(2);
    const first = await mount();
    await waitFor(() => expect(first.result.current.skipsLeft).toBe(2));
    await act(async () => first.result.current.skipUpdate());
    expect(first.result.current.updateSkipped).toBe(true);
    expect(first.result.current.skipsLeft).toBe(1);
    await first.unmount();

    // «Reabrir la app»: la sesión se resetea, el contador no.
    const second = await mount();
    await waitFor(() => expect(second.result.current.skipsLeft).toBe(1));
    expect(second.result.current.updateSkipped).toBe(false);
    await act(async () => second.result.current.skipUpdate());
    expect(second.result.current.skipsLeft).toBe(0);
    await second.unmount();

    const third = await mount();
    await waitFor(() => expect(third.result.current.skipsLeft).toBe(0));
    expect(third.result.current.canSkip).toBe(false);
  });

  it('mientras no ha leído el contador no ofrece saltar', async () => {
    block(3);
    let finishRead: (v: string | null) => void = () => {};
    (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(
      () => new Promise((resolve) => (finishRead = resolve)),
    );
    const { result } = await mount();
    expect(result.current.canSkip).toBe(false);
    await act(async () => finishRead(null));
    expect(result.current.canSkip).toBe(true);
    expect(result.current.skipsLeft).toBe(3);
  });

  it('si el panel sube la versión mínima, empieza de cero', async () => {
    await AsyncStorage.setItem(
      'versionGateSkips',
      JSON.stringify({ forVersion: '2.9.0', used: 3 }),
    );
    block(3);
    const { result } = await mount();
    await waitFor(() => expect(result.current.skipsLeft).toBe(3));
  });

  it('un contador corrupto en disco no bloquea: cuenta como 0 gastados', async () => {
    await AsyncStorage.setItem('versionGateSkips', '{no es json');
    block(1);
    const { result } = await mount();
    await waitFor(() => expect(result.current.skipsLeft).toBe(1));
  });
});

describe('openStore', () => {
  it('delega en openAppStore', async () => {
    const { result } = await mount();
    await act(async () => result.current.openStore());
    expect(openAppStore).toHaveBeenCalled();
  });
});

describe('fuera del provider', () => {
  it('devuelve los defaults sin reventar', async () => {
    const { result } = await renderHook(() => useVersionGate());
    expect(result.current.updateRequired).toBe(false);
    expect(result.current.updateSkipped).toBe(false);
    expect(() => result.current.skipUpdate()).not.toThrow();
    expect(() => result.current.openStore()).not.toThrow();
  });
});

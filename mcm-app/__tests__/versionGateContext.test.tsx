/**
 * Tests de `VersionGateContext`: la pantalla de actualización obligatoria.
 * `isAppVersionSupported` (el semver puro) ya está testeado en
 * `resolveProfileConfig.test.ts`; aquí se testea la orquestación: que
 * `updateRequired` reaccione al `minAppVersion` resuelto, que "saltar" el
 * aviso sea solo de esta sesión, y que abrir la tienda delegue en
 * `openAppStore`.
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
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

beforeEach(() => {
  jest.clearAllMocks();
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

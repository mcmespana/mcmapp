/**
 * Tests de `PreviewChannelContext`: el estado del "modo tester" (canal
 * `preview` de EAS Update). La mecánica real vive en
 * `services/previewChannel.ts` (mockeado aquí); lo que se cubre es la
 * orquestación: arranque optimista con reversión si falla, que dos toques
 * seguidos al interruptor no disparen dos cambios de canal a la vez, y que
 * el resultado de la comprobación de update se traduzca al estado que pinta
 * la UI.
 */
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  applyChannel,
  fetchFromCurrentChannel,
  readChannelDiagnostics,
  restartApp,
  syncChannelOverride,
} from '@/services/previewChannel';
import {
  PreviewChannelProvider,
  usePreviewChannel,
} from '@/contexts/PreviewChannelContext';

const STORAGE_KEY = '@mcm_preview_channel_enabled';

jest.mock('@/services/previewChannel', () => ({
  PREVIEW_CHANNEL: 'preview',
  applyChannel: jest.fn(() => ({ ok: true })),
  fetchFromCurrentChannel: jest.fn(() => Promise.resolve({ kind: 'up-to-date' })),
  readChannelDiagnostics: jest.fn(() => ({
    activeChannel: 'production',
    runtimeVersion: '1.0.0',
    updateId: null,
    isEmbeddedLaunch: true,
  })),
  restartApp: jest.fn(() => Promise.resolve()),
  syncChannelOverride: jest.fn(() => null),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <PreviewChannelProvider>{children}</PreviewChannelProvider>
);

async function mount() {
  const hook = await renderHook(() => usePreviewChannel(), { wrapper });
  await waitFor(() => expect(hook.result.current.hydrated).toBe(true));
  return hook;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  (applyChannel as jest.Mock).mockReturnValue({ ok: true });
  (fetchFromCurrentChannel as jest.Mock).mockResolvedValue({
    kind: 'up-to-date',
  });
  (readChannelDiagnostics as jest.Mock).mockReturnValue({
    activeChannel: 'production',
    runtimeVersion: '1.0.0',
    updateId: null,
    isEmbeddedLaunch: true,
  });
  (syncChannelOverride as jest.Mock).mockReturnValue(null);
});

describe('arranque', () => {
  it('lee el flag guardado y reconcilia el override nativo', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, '1');
    const { result } = await mount();
    expect(result.current.enabled).toBe(true);
    expect(syncChannelOverride).toHaveBeenCalledWith(true);
    expect(result.current.diagnostics.activeChannel).toBe('production');
  });

  it('arranca desactivado si no hay flag guardado', async () => {
    const { result } = await mount();
    expect(result.current.enabled).toBe(false);
    expect(syncChannelOverride).toHaveBeenCalledWith(false);
  });

  it('reconcilia también con el flag apagado (un override heredado no debe quedar colgado)', async () => {
    await mount();
    expect(syncChannelOverride).toHaveBeenCalledTimes(1);
    expect(syncChannelOverride).toHaveBeenCalledWith(false);
  });

  it('un binario sin soporte marca `unsupported` ya desde el arranque', async () => {
    (syncChannelOverride as jest.Mock).mockReturnValue('build');
    const { result } = await mount();
    expect(result.current.unsupported).toBe('build');
  });
});

describe('setEnabled', () => {
  it('activa el canal de forma optimista y persiste el flag', async () => {
    const { result } = await mount();
    await act(async () => result.current.setEnabled(true));
    expect(result.current.enabled).toBe(true);
    expect(applyChannel).toHaveBeenCalledWith(true);
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe('1');
  });

  it('traduce "ready" del fetch a status "ready"', async () => {
    (fetchFromCurrentChannel as jest.Mock).mockResolvedValueOnce({
      kind: 'ready',
    });
    const { result } = await mount();
    await act(async () => result.current.setEnabled(true));
    expect(result.current.status).toEqual({ kind: 'ready' });
  });

  it('traduce un fallo de red del fetch a status "offline"', async () => {
    (fetchFromCurrentChannel as jest.Mock).mockResolvedValueOnce({
      kind: 'check-failed',
      message: 'sin conexión',
    });
    const { result } = await mount();
    await act(async () => result.current.setEnabled(true));
    expect(result.current.status).toEqual({
      kind: 'offline',
      message: 'sin conexión',
    });
  });

  it('si applyChannel falla, revierte el estado optimista y no persiste', async () => {
    (applyChannel as jest.Mock).mockReturnValue({
      ok: false,
      kind: 'unsupported',
      reason: 'dev',
    });
    const { result } = await mount();
    await act(async () => result.current.setEnabled(true));
    expect(result.current.enabled).toBe(false);
    expect(result.current.unsupported).toBe('dev');
    expect(result.current.status).toEqual({ kind: 'unsupported', reason: 'dev' });
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('un error genérico de applyChannel revierte con status "error"', async () => {
    (applyChannel as jest.Mock).mockReturnValue({
      ok: false,
      kind: 'error',
      message: 'algo raro',
    });
    const { result } = await mount();
    await act(async () => result.current.setEnabled(true));
    expect(result.current.enabled).toBe(false);
    expect(result.current.status).toEqual({ kind: 'error', message: 'algo raro' });
  });

  it('una excepción inesperada durante el cambio también se convierte en status "error"', async () => {
    (fetchFromCurrentChannel as jest.Mock).mockRejectedValueOnce(
      new Error('boom'),
    );
    const { result } = await mount();
    await act(async () => result.current.setEnabled(true));
    expect(result.current.status).toEqual({ kind: 'error', message: 'boom' });
  });

  it('dos toques seguidos sin esperar solo disparan un cambio de canal', async () => {
    const { result } = await mount();
    await act(async () => {
      const p1 = result.current.setEnabled(true);
      const p2 = result.current.setEnabled(true);
      await Promise.all([p1, p2]);
    });
    expect(applyChannel).toHaveBeenCalledTimes(1);
  });
});

describe('restart', () => {
  it('llama a restartApp', async () => {
    const { result } = await mount();
    await act(async () => result.current.restart());
    expect(restartApp).toHaveBeenCalled();
  });

  it('si restartApp falla, deja un status de error en vez de reventar', async () => {
    (restartApp as jest.Mock).mockRejectedValueOnce(new Error('no boot'));
    const { result } = await mount();
    await act(async () => result.current.restart());
    expect(result.current.status).toEqual({ kind: 'error', message: 'no boot' });
  });
});

describe('menú secreto', () => {
  it('openSecretMenu refresca diagnostics y abre el menú', async () => {
    const { result } = await mount();
    (readChannelDiagnostics as jest.Mock).mockReturnValue({
      activeChannel: 'preview',
      runtimeVersion: '1.0.0',
      updateId: 'u1',
      isEmbeddedLaunch: false,
    });
    await act(async () => result.current.openSecretMenu());
    expect(result.current.isSecretMenuOpen).toBe(true);
    expect(result.current.diagnostics.activeChannel).toBe('preview');
  });

  it('closeSecretMenu lo cierra', async () => {
    const { result } = await mount();
    await act(async () => result.current.openSecretMenu());
    await act(async () => result.current.closeSecretMenu());
    expect(result.current.isSecretMenuOpen).toBe(false);
  });
});

describe('fuera del provider', () => {
  it('devuelve los defaults sin reventar', async () => {
    const { result } = await renderHook(() => usePreviewChannel());
    expect(result.current.enabled).toBe(false);
    expect(result.current.hydrated).toBe(false);
    expect(result.current.status).toEqual({ kind: 'idle' });
    await expect(result.current.setEnabled(true)).resolves.toBeUndefined();
  });
});

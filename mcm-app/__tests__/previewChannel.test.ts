import * as Updates from 'expo-updates';
import {
  CHANNEL_HEADER,
  PREVIEW_CHANNEL,
  applyChannel,
  fetchFromCurrentChannel,
  getUnsupportedReason,
  syncChannelOverride,
} from '@/services/previewChannel';

jest.mock('expo-updates', () => ({
  __esModule: true,
  isEnabled: true,
  channel: 'production',
  runtimeVersion: '2.1.0',
  updateId: null,
  isEmbeddedLaunch: true,
  setUpdateRequestHeadersOverride: jest.fn(),
  setUpdateURLAndRequestHeadersOverride: jest.fn(),
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}));

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const mocked = Updates as jest.Mocked<typeof Updates> & {
  isEnabled: boolean;
};

/** Error tal y como lo lanza expo-updates cuando la build no declara la cabecera. */
function runtimeOverrideError(): Error & { code: string } {
  const err = new Error(
    'Invalid update requestHeaders override. Override keys must be declared in `updates.requestHeaders`.',
  ) as Error & { code: string };
  err.code = 'ERR_UPDATES_RUNTIME_OVERRIDE';
  return err;
}

beforeEach(() => {
  // `reset`, no `clear`: los `mockImplementation` que lanzan se filtrarían al
  // resto de tests y darían falsos "build no soportada".
  jest.resetAllMocks();
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  mocked.isEnabled = true;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('getUnsupportedReason', () => {
  it('descarta las builds de desarrollo', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    expect(getUnsupportedReason()).toBe('dev');
  });

  it('descarta las instalaciones sin EAS Update', () => {
    mocked.isEnabled = false;
    expect(getUnsupportedReason()).toBe('disabled');
  });

  it('acepta una build de tienda normal', () => {
    expect(getUnsupportedReason()).toBeNull();
  });
});

describe('applyChannel', () => {
  it('manda la cabecera del canal preview al activar', () => {
    expect(applyChannel(true)).toEqual({ ok: true });
    expect(mocked.setUpdateRequestHeadersOverride).toHaveBeenCalledWith({
      [CHANNEL_HEADER]: PREVIEW_CHANNEL,
    });
  });

  it('limpia el override al desactivar, para volver al canal de la build', () => {
    expect(applyChannel(false)).toEqual({ ok: true });
    expect(mocked.setUpdateRequestHeadersOverride).toHaveBeenCalledWith(null);
  });

  it('limpia el override de URL heredado ANTES de aplicar el suyo', () => {
    const order: string[] = [];
    mocked.setUpdateURLAndRequestHeadersOverride.mockImplementation(() => {
      order.push('legacy');
    });
    mocked.setUpdateRequestHeadersOverride.mockImplementation(() => {
      order.push('headers');
    });

    applyChannel(true);

    // Al revés, borrar el override antiguo se llevaría por delante el nuevo:
    // en nativo se guardan en la misma entrada.
    expect(order).toEqual(['legacy', 'headers']);
  });

  it('sobrevive a que el binario no admita el override de URL heredado', () => {
    mocked.setUpdateURLAndRequestHeadersOverride.mockImplementation(() => {
      throw new Error('Must set disableAntiBrickingMeasures configuration');
    });
    expect(applyChannel(true)).toEqual({ ok: true });
    expect(mocked.setUpdateRequestHeadersOverride).toHaveBeenCalled();
  });

  it('reporta "build" cuando el binario no declara expo-channel-name', () => {
    mocked.setUpdateRequestHeadersOverride.mockImplementation(() => {
      throw runtimeOverrideError();
    });
    expect(applyChannel(true)).toEqual({
      ok: false,
      kind: 'unsupported',
      reason: 'build',
    });
  });

  it('no toca nada en una build de desarrollo', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    expect(applyChannel(true)).toEqual({
      ok: false,
      kind: 'unsupported',
      reason: 'dev',
    });
    expect(mocked.setUpdateRequestHeadersOverride).not.toHaveBeenCalled();
  });
});

describe('fetchFromCurrentChannel', () => {
  it('descarga el update disponible del canal nuevo', async () => {
    mocked.checkForUpdateAsync.mockResolvedValue({
      isAvailable: true,
    } as Awaited<ReturnType<typeof Updates.checkForUpdateAsync>>);
    mocked.fetchUpdateAsync.mockResolvedValue({ isNew: true } as Awaited<
      ReturnType<typeof Updates.fetchUpdateAsync>
    >);

    await expect(fetchFromCurrentChannel()).resolves.toEqual({ kind: 'ready' });
  });

  it('informa de que no hay nada nuevo sin descargar', async () => {
    mocked.checkForUpdateAsync.mockResolvedValue({
      isAvailable: false,
    } as Awaited<ReturnType<typeof Updates.checkForUpdateAsync>>);

    await expect(fetchFromCurrentChannel()).resolves.toEqual({
      kind: 'up-to-date',
    });
    expect(mocked.fetchUpdateAsync).not.toHaveBeenCalled();
  });

  it('un fallo de red no invalida el cambio de canal', async () => {
    mocked.checkForUpdateAsync.mockRejectedValue(
      new Error('Network request failed'),
    );

    await expect(fetchFromCurrentChannel()).resolves.toEqual({
      kind: 'check-failed',
      message: 'Network request failed',
    });
  });
});

describe('syncChannelOverride (arranque)', () => {
  it('reafirma preview cuando el flag está encendido', () => {
    expect(syncChannelOverride(true)).toBeNull();
    expect(mocked.setUpdateRequestHeadersOverride).toHaveBeenCalledWith({
      [CHANNEL_HEADER]: PREVIEW_CHANNEL,
    });
  });

  it('limpia cualquier override colgado cuando el flag está apagado', () => {
    // Esta es la garantía de que un usuario normal nunca se queda atrapado en
    // preview por un override heredado que nadie borró.
    expect(syncChannelOverride(false)).toBeNull();
    expect(mocked.setUpdateRequestHeadersOverride).toHaveBeenCalledWith(null);
  });

  it('devuelve el motivo cuando la build no lo admite', () => {
    mocked.setUpdateRequestHeadersOverride.mockImplementation(() => {
      throw runtimeOverrideError();
    });
    expect(syncChannelOverride(true)).toBe('build');
  });
});

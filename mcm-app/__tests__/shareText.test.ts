/**
 * shareText — «Compartir» no puede fallar en silencio.
 *
 * En un navegador sin Web Share, `Share.share` de react-native-web rechaza la
 * promesa; antes nadie la capturaba y la acción parecía muerta.
 */
import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { shareText } from '@/utils/shareText';
import { logger } from '@/utils/logger';

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve(true)),
}));

const REAL_OS = Platform.OS;
function setOS(os: string) {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
}

const nav = globalThis.navigator as unknown as Record<string, unknown>;
const realShare = nav?.share;
function setWebShare(fn: unknown) {
  Object.defineProperty(nav, 'share', {
    value: fn,
    configurable: true,
    writable: true,
  });
}

let shareSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  shareSpy = jest
    .spyOn(Share, 'share')
    .mockResolvedValue({ action: Share.sharedAction });
  jest.spyOn(logger, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  setOS(REAL_OS);
  setWebShare(realShare);
  jest.restoreAllMocks();
});

describe('shareText', () => {
  it('en móvil abre la hoja del sistema', async () => {
    setOS('ios');
    const notify = jest.fn();
    await expect(shareText('Hola', { notify })).resolves.toBe('shared');
    expect(shareSpy).toHaveBeenCalledWith({ message: 'Hola' });
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('en web sin Web Share copia al portapapeles y lo avisa', async () => {
    setOS('web');
    setWebShare(undefined);
    const notify = jest.fn();
    await expect(shareText('Hola', { notify })).resolves.toBe('copied');
    expect(shareSpy).not.toHaveBeenCalled();
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('Hola');
    expect(notify).toHaveBeenCalledWith('Copiado al portapapeles');
  });

  it('en web con Web Share comparte, salvo que se pida copiar', async () => {
    setOS('web');
    setWebShare(jest.fn());
    await expect(shareText('Hola')).resolves.toBe('shared');

    const notify = jest.fn();
    await expect(
      shareText('Lista', {
        notify,
        copyOnDesktop: true,
        copiedLabel: 'Lista copiada al portapapeles',
      }),
    ).resolves.toBe('copied');
    expect(notify).toHaveBeenCalledWith('Lista copiada al portapapeles');
  });

  it('cerrar la hoja (AbortError) no es un error ni avisa', async () => {
    setOS('web');
    setWebShare(jest.fn());
    shareSpy.mockRejectedValueOnce(
      Object.assign(new Error('cancel'), { name: 'AbortError' }),
    );
    const notify = jest.fn();
    await expect(shareText('Hola', { notify })).resolves.toBe('dismissed');
    expect(notify).not.toHaveBeenCalled();
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
  });

  it('si Web Share falla por otra cosa, copia en vez de quedarse muda', async () => {
    setOS('web');
    setWebShare(jest.fn());
    shareSpy.mockRejectedValueOnce(new Error('NotAllowedError'));
    const notify = jest.fn();
    await expect(shareText('Hola', { notify })).resolves.toBe('copied');
    expect(notify).toHaveBeenCalledWith('Copiado al portapapeles');
  });

  it('en nativo, un fallo se avisa y no se propaga', async () => {
    setOS('android');
    shareSpy.mockRejectedValueOnce(new Error('boom'));
    const notify = jest.fn();
    await expect(shareText('Hola', { notify })).resolves.toBe('failed');
    expect(notify).toHaveBeenCalledWith('No se pudo compartir');
  });
});

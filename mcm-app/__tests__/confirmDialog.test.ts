/**
 * `confirmAsync`: la confirmación de gestos destructivos, igual en nativo y en
 * web. En web `Alert.alert` de react-native-web no hace nada, así que sin el
 * rodeo por `window.confirm` el usuario pulsaba y no pasaba nada.
 */
import { Alert, Platform } from 'react-native';
import { confirmAsync } from '@/utils/confirmDialog';

const REAL_OS = Platform.OS;
const setOS = (os: 'ios' | 'android' | 'web') =>
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });

const opts = {
  title: '¿Quitar?',
  message: 'Se borrará.',
  confirmLabel: 'Quitar',
  destructive: true,
};

const REAL_WINDOW = (globalThis as { window?: unknown }).window;

afterEach(() => {
  (globalThis as { window?: unknown }).window = REAL_WINDOW;
  setOS(REAL_OS as 'ios');
  jest.restoreAllMocks();
});

describe('confirmAsync · nativo', () => {
  beforeEach(() => setOS('ios'));

  it('resuelve true al pulsar el botón de confirmar (destructivo)', async () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, b) => {
      b?.find((x) => x.style === 'destructive')?.onPress?.();
    });
    await expect(confirmAsync(opts)).resolves.toBe(true);
    expect(spy.mock.calls[0][0]).toBe('¿Quitar?');
  });

  it('resuelve false al cancelar', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, b) => {
      b?.find((x) => x.style === 'cancel')?.onPress?.();
    });
    await expect(confirmAsync(opts)).resolves.toBe(false);
  });

  it('cerrar la alerta tocando fuera cuenta como cancelar', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, _b, o) => {
      o?.onDismiss?.();
    });
    await expect(confirmAsync(opts)).resolves.toBe(false);
  });

  it('sin `destructive` el botón es normal', async () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    void confirmAsync({ ...opts, destructive: false });
    const buttons = spy.mock.calls[0][2]!;
    expect(buttons[1].style).toBe('default');
  });
});

describe('confirmAsync · web', () => {
  beforeEach(() => setOS('web'));

  it('usa window.confirm y no toca Alert', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const confirm = jest.fn(() => true);
    (globalThis as { window?: unknown }).window = { confirm };
    await expect(confirmAsync(opts)).resolves.toBe(true);
    expect(confirm).toHaveBeenCalledWith('¿Quitar?\n\nSe borrará.');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('resuelve false si el usuario cancela', async () => {
    (globalThis as { window?: unknown }).window = { confirm: () => false };
    await expect(confirmAsync(opts)).resolves.toBe(false);
  });
});

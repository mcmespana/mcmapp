/**
 * Tests de `openAppStore` (utils/storeLinks.ts).
 *
 * El caso que importa es la PWA: `Platform.OS` es 'web' aunque el usuario esté
 * en un iPhone, así que hay que mirar el user-agent para no mandarlo a la Play
 * Store. También se cubre el fallback a https cuando el esquema nativo
 * (`itms-apps://` / `market://`) no está disponible.
 */
import { Linking, Platform } from 'react-native';
import { openAppStore } from '@/utils/storeLinks';

jest.mock('@/utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const openURL = Linking.openURL as unknown as jest.Mock;

function setPlatform(os: 'ios' | 'android' | 'web') {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
}

const REAL_OS = Platform.OS;

beforeEach(() => {
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
});

afterEach(() => {
  jest.restoreAllMocks();
  setPlatform(REAL_OS as 'ios');
});

describe('openAppStore en nativo', () => {
  it('abre el esquema nativo de la App Store en iOS', async () => {
    setPlatform('ios');
    await openAppStore();
    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledWith(
      'itms-apps://apps.apple.com/app/id6745557177',
    );
  });

  it('cae al enlace https si el esquema de iOS falla', async () => {
    setPlatform('ios');
    openURL
      .mockRejectedValueOnce(new Error('no handler'))
      .mockResolvedValueOnce(true);
    await openAppStore();
    expect(openURL).toHaveBeenLastCalledWith(
      'https://apps.apple.com/app/id6745557177',
    );
  });

  it('abre el esquema nativo de Play Store en Android', async () => {
    setPlatform('android');
    await openAppStore();
    expect(openURL).toHaveBeenCalledWith(
      'market://details?id=com.mcmespana.mcmapp',
    );
  });

  it('cae al enlace https si el esquema de Android falla', async () => {
    setPlatform('android');
    openURL
      .mockRejectedValueOnce(new Error('no handler'))
      .mockResolvedValueOnce(true);
    await openAppStore();
    expect(openURL).toHaveBeenLastCalledWith(
      'https://play.google.com/store/apps/details?id=com.mcmespana.mcmapp',
    );
  });

  it('no revienta si también falla el enlace https', async () => {
    setPlatform('android');
    openURL.mockRejectedValue(new Error('nada que abrir'));
    await expect(openAppStore()).resolves.toBeUndefined();
  });
});

describe('openAppStore en web (PWA)', () => {
  const uaSpy = () =>
    jest.spyOn(navigator, 'userAgent', 'get') as jest.SpyInstance<string>;

  it('manda a la App Store si el user-agent es de iPhone', async () => {
    setPlatform('web');
    uaSpy().mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)');
    await openAppStore();
    expect(openURL).toHaveBeenCalledWith(
      'https://apps.apple.com/app/id6745557177',
    );
  });

  it('manda a Play Store si el user-agent es de Android', async () => {
    setPlatform('web');
    uaSpy().mockReturnValue('Mozilla/5.0 (Linux; Android 14; Pixel 8)');
    await openAppStore();
    expect(openURL).toHaveBeenCalledWith(
      'https://play.google.com/store/apps/details?id=com.mcmespana.mcmapp',
    );
  });

  it('usa la App Store como destino por defecto en escritorio', async () => {
    setPlatform('web');
    uaSpy().mockReturnValue('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
    await openAppStore();
    expect(openURL).toHaveBeenCalledWith(
      'https://apps.apple.com/app/id6745557177',
    );
  });
});

/**
 * Tests de `openAppStore` (utils/storeLinks.ts).
 *
 * El caso que importa es la PWA: `Platform.OS` es 'web' aunque el usuario esté
 * en un iPhone, así que hay que mirar el user-agent para no mandarlo a la Play
 * Store. También se cubre el fallback a https cuando el esquema nativo
 * (`itms-apps://` / `market://`) no está disponible.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Linking, Platform } from 'react-native';
import { openAppStore } from '@/utils/storeLinks';

jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
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
      'itms-apps://apps.apple.com/app/id6753905393',
    );
  });

  it('cae al enlace https si el esquema de iOS falla', async () => {
    setPlatform('ios');
    openURL
      .mockRejectedValueOnce(new Error('no handler'))
      .mockResolvedValueOnce(true);
    await openAppStore();
    expect(openURL).toHaveBeenLastCalledWith(
      'https://apps.apple.com/app/id6753905393',
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
  // Estos tests espiaban el `navigator` GLOBAL, y ahí no hay ninguno que
  // espiar: `navigator` como global de Node llegó en la 21, y la CI fija Node
  // 20 (`verify.yml`). En local, con Node 22+, existía y los tests pasaban —
  // por eso el fallo solo salía al subir. Montamos siempre el nuestro, así el
  // test no depende de la versión de Node que le toque.
  const realNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    'navigator',
  );
  let userAgent = '';
  const setUserAgent = (ua: string) => {
    userAgent = ua;
  };

  beforeAll(() => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      get: () => ({
        get userAgent() {
          return userAgent;
        },
      }),
    });
  });

  afterAll(() => {
    if (realNavigator) {
      Object.defineProperty(globalThis, 'navigator', realNavigator);
    } else {
      delete (globalThis as { navigator?: unknown }).navigator;
    }
  });

  it('manda a la App Store si el user-agent es de iPhone', async () => {
    setPlatform('web');
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)');
    await openAppStore();
    expect(openURL).toHaveBeenCalledWith(
      'https://apps.apple.com/app/id6753905393',
    );
  });

  it('manda a Play Store si el user-agent es de Android', async () => {
    setPlatform('web');
    setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)');
    await openAppStore();
    expect(openURL).toHaveBeenCalledWith(
      'https://play.google.com/store/apps/details?id=com.mcmespana.mcmapp',
    );
  });

  it('usa la App Store como destino por defecto en escritorio', async () => {
    setPlatform('web');
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
    await openAppStore();
    expect(openURL).toHaveBeenCalledWith(
      'https://apps.apple.com/app/id6753905393',
    );
  });
});

describe('id de la App Store', () => {
  // 2026-11-07: el enlace llevaba un id que no existía (6745557177) y
  // «Actualizar en la tienda» decía «no disponible en tu país» justo al subir
  // la versión mínima. El id bueno es el `ascAppId` con el que se sube la app.
  const root = path.join(__dirname, '..');

  it('es el mismo con el que se publica (ascAppId de eas.json)', () => {
    const eas = JSON.parse(
      fs.readFileSync(path.join(root, 'eas.json'), 'utf8'),
    );
    const ascAppId: string = eas.submit.production.ios.ascAppId;
    const src = fs.readFileSync(path.join(root, 'utils/storeLinks.ts'), 'utf8');
    expect(src).toContain(`const IOS_APP_ID = '${ascAppId}';`);
  });

  it('el id viejo y roto no vuelve a ningún fichero de la app', () => {
    const hits = execSync(
      'git grep -l "id6745557177" -- . ":!__tests__" || true',
      { cwd: root, encoding: 'utf8' },
    );
    expect(hits.trim()).toBe('');
  });
});

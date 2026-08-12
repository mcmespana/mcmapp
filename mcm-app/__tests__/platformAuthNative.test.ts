/**
 * Tests de `utils/platformAuth.native.ts` — el flujo de login nativo, con
 * foco en **Android**, que es donde estuvo apagado hasta agosto de 2026.
 *
 * Lo que se cubre y por qué:
 * - En Android sin `webClientId` no llega `idToken` y Firebase no puede crear
 *   sesión: tiene que fallar con un error de configuración explícito, no en
 *   silencio.
 * - `hasPlayServices` solo se llama en Android (en iOS es un no-op).
 * - La configuración se aplica ANTES del `signIn()` aunque nadie haya llamado
 *   a `configureGoogleSignIn()` en el arranque.
 * - Cancelaciones y DEVELOPER_ERROR salen ya normalizados como `AuthError`.
 * - Apple no se ofrece en Android.
 *
 * El módulo nativo se importa de forma perezosa dentro de las funciones, así
 * que basta con `jest.mock` del paquete.
 */
import { AUTH_ERROR } from '@/utils/authErrors';

const mockConfigure = jest.fn();
const mockSignIn = jest.fn();
const mockSignOut = jest.fn();
const mockHasPlayServices = jest.fn().mockResolvedValue(true);

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: (...args: unknown[]) => mockConfigure(...args),
    signIn: (...args: unknown[]) => mockSignIn(...args),
    signOut: (...args: unknown[]) => mockSignOut(...args),
    hasPlayServices: (...args: unknown[]) => mockHasPlayServices(...args),
  },
}));

const mockSignInWithCredential = jest.fn();
const mockGoogleCredential = jest.fn((token: string) => ({
  providerId: 'google.com',
  token,
}));

jest.mock('firebase/auth', () => ({
  GoogleAuthProvider: { credential: (t: string) => mockGoogleCredential(t) },
  OAuthProvider: class {
    credential(params: unknown) {
      return { providerId: 'apple.com', params };
    }
  },
  signInWithCredential: (...args: unknown[]) =>
    mockSignInWithCredential(...args),
  updateProfile: jest.fn(),
}));

const mockAppleIsAvailable = jest.fn().mockResolvedValue(true);
const mockAppleSignInAsync = jest.fn();

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: () => mockAppleIsAvailable(),
  signInAsync: (...args: unknown[]) => mockAppleSignInAsync(...args),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

const WEB_CLIENT_ID = 'web-client-id.apps.googleusercontent.com';
const IOS_CLIENT_ID = 'ios-client-id.apps.googleusercontent.com';

/** Recarga el módulo con la plataforma y el entorno pedidos. */
async function loadPlatformAuth(
  os: 'ios' | 'android',
  env: Record<string, string | undefined> = {
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: WEB_CLIENT_ID,
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: IOS_CLIENT_ID,
  },
) {
  jest.resetModules();
  // `react-native` reexporta Platform desde este módulo con `.default`.
  jest.doMock('react-native/Libraries/Utilities/Platform', () => ({
    __esModule: true,
    default: {
      OS: os,
      select: (obj: Record<string, unknown>) => obj[os] ?? obj.default,
    },
  }));
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  // `require` y no `import()`: bajo Jest el import dinámico no se transforma
  // a CommonJS y revienta con "--experimental-vm-modules".
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/utils/platformAuth.native') as typeof import('@/utils/platformAuth.native');
}

const fakeAuth = {} as never;

/** Devuelve el error lanzado por `fn`, fallando el test si no lanza. */
async function captureError(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (err) {
    return err as { code?: string; message?: string };
  }
  throw new Error('Se esperaba un error y no lo hubo');
}

const originalEnv = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  mockHasPlayServices.mockResolvedValue(true);
  mockSignInWithCredential.mockResolvedValue({
    user: { uid: 'u1', displayName: 'Ana', reload: jest.fn() },
  });
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('doGoogleSignIn — Android', () => {
  it('configura con el webClientId y canjea el idToken en Firebase', async () => {
    const auth = await loadPlatformAuth('android');
    mockSignIn.mockResolvedValue({
      type: 'success',
      data: { idToken: 'id-token-123' },
    });

    await auth.doGoogleSignIn(fakeAuth);

    expect(mockConfigure).toHaveBeenCalledTimes(1);
    expect(mockConfigure).toHaveBeenCalledWith(
      expect.objectContaining({ webClientId: WEB_CLIENT_ID }),
    );
    // El iosClientId no viaja a la config de Android.
    expect(mockConfigure.mock.calls[0][0]).not.toHaveProperty('iosClientId');
    expect(mockGoogleCredential).toHaveBeenCalledWith('id-token-123');
    expect(mockSignInWithCredential).toHaveBeenCalledTimes(1);
  });

  it('comprueba Google Play Services antes de abrir el selector', async () => {
    const auth = await loadPlatformAuth('android');
    mockSignIn.mockResolvedValue({
      type: 'success',
      data: { idToken: 'tok' },
    });

    await auth.doGoogleSignIn(fakeAuth);

    expect(mockHasPlayServices).toHaveBeenCalledWith({
      showPlayServicesUpdateDialog: true,
    });
  });

  it('configura aunque nadie haya llamado antes a configureGoogleSignIn', async () => {
    const auth = await loadPlatformAuth('android');
    mockSignIn.mockResolvedValue({
      type: 'success',
      data: { idToken: 'tok' },
    });

    await auth.doGoogleSignIn(fakeAuth);

    expect(mockConfigure).toHaveBeenCalled();
    expect(mockConfigure.mock.invocationCallOrder[0]).toBeLessThan(
      mockSignIn.mock.invocationCallOrder[0],
    );
  });

  it('solo configura una vez aunque se entre varias veces', async () => {
    const auth = await loadPlatformAuth('android');
    mockSignIn.mockResolvedValue({
      type: 'success',
      data: { idToken: 'tok' },
    });

    await auth.configureGoogleSignIn();
    await auth.doGoogleSignIn(fakeAuth);
    await auth.doGoogleSignIn(fakeAuth);

    expect(mockConfigure).toHaveBeenCalledTimes(1);
  });

  it('falla con error de configuración si no hay webClientId en el build', async () => {
    const auth = await loadPlatformAuth('android', {
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: undefined,
      EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: undefined,
    });

    const err = await captureError(() => auth.doGoogleSignIn(fakeAuth));

    expect(err.code).toBe(AUTH_ERROR.MISCONFIGURED);
    expect(mockConfigure).not.toHaveBeenCalled();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('normaliza la cancelación por objeto ({ type: "cancelled" })', async () => {
    const auth = await loadPlatformAuth('android');
    mockSignIn.mockResolvedValue({ type: 'cancelled', data: null });

    const err = await captureError(() => auth.doGoogleSignIn(fakeAuth));

    expect(err.code).toBe(AUTH_ERROR.CANCELLED);
    expect(mockSignInWithCredential).not.toHaveBeenCalled();
  });

  it('normaliza la cancelación lanzada como 12501', async () => {
    const auth = await loadPlatformAuth('android');
    mockSignIn.mockRejectedValue(
      Object.assign(new Error('cancelled'), { code: '12501' }),
    );

    const err = await captureError(() => auth.doGoogleSignIn(fakeAuth));

    expect(err.code).toBe(AUTH_ERROR.CANCELLED);
  });

  it('convierte DEVELOPER_ERROR en error de configuración', async () => {
    const auth = await loadPlatformAuth('android');
    mockSignIn.mockRejectedValue(
      Object.assign(new Error('DEVELOPER_ERROR'), { code: '10' }),
    );

    const err = await captureError(() => auth.doGoogleSignIn(fakeAuth));

    expect(err.code).toBe(AUTH_ERROR.MISCONFIGURED);
  });

  it('avisa de que faltan Play Services', async () => {
    const auth = await loadPlatformAuth('android');
    mockHasPlayServices.mockRejectedValue(
      Object.assign(new Error('no play services'), {
        code: 'PLAY_SERVICES_NOT_AVAILABLE',
      }),
    );

    const err = await captureError(() => auth.doGoogleSignIn(fakeAuth));

    expect(err.code).toBe(AUTH_ERROR.PLAY_SERVICES);
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('trata la falta de idToken como configuración incorrecta', async () => {
    const auth = await loadPlatformAuth('android');
    mockSignIn.mockResolvedValue({ type: 'success', data: { idToken: null } });

    const err = await captureError(() => auth.doGoogleSignIn(fakeAuth));

    expect(err.code).toBe(AUTH_ERROR.MISCONFIGURED);
    expect(mockSignInWithCredential).not.toHaveBeenCalled();
  });
});

describe('doGoogleSignIn — iOS', () => {
  it('manda también el iosClientId y se salta hasPlayServices', async () => {
    const auth = await loadPlatformAuth('ios');
    mockSignIn.mockResolvedValue({
      type: 'success',
      data: { idToken: 'tok' },
    });

    await auth.doGoogleSignIn(fakeAuth);

    expect(mockConfigure).toHaveBeenCalledWith(
      expect.objectContaining({
        webClientId: WEB_CLIENT_ID,
        iosClientId: IOS_CLIENT_ID,
      }),
    );
    expect(mockHasPlayServices).not.toHaveBeenCalled();
  });
});

describe('Apple Sign-In', () => {
  it('no está disponible en Android', async () => {
    const auth = await loadPlatformAuth('android');
    await expect(auth.isAppleSignInAvailable()).resolves.toBe(false);

    const err = await captureError(() => auth.doAppleSignIn(fakeAuth));
    expect(err.code).toBe(AUTH_ERROR.APPLE_UNSUPPORTED);
    expect(mockAppleSignInAsync).not.toHaveBeenCalled();
  });

  it('sigue funcionando en iOS', async () => {
    const auth = await loadPlatformAuth('ios');
    mockAppleSignInAsync.mockResolvedValue({
      identityToken: 'apple-token',
      fullName: null,
    });

    await expect(auth.isAppleSignInAvailable()).resolves.toBe(true);
    await auth.doAppleSignIn(fakeAuth);

    expect(mockSignInWithCredential).toHaveBeenCalledTimes(1);
  });

  it('normaliza la cancelación de Apple (ERR_REQUEST_CANCELED)', async () => {
    const auth = await loadPlatformAuth('ios');
    mockAppleSignInAsync.mockRejectedValue(
      Object.assign(new Error('The user canceled'), {
        code: 'ERR_REQUEST_CANCELED',
      }),
    );

    const err = await captureError(() => auth.doAppleSignIn(fakeAuth));

    expect(err.code).toBe(AUTH_ERROR.CANCELLED);
  });
});

describe('doGoogleSignOut', () => {
  it('cierra la sesión nativa sin propagar errores', async () => {
    const auth = await loadPlatformAuth('android');
    mockSignOut.mockRejectedValue(new Error('boom'));

    await expect(auth.doGoogleSignOut()).resolves.toBeUndefined();
    expect(mockSignOut).toHaveBeenCalled();
  });
});

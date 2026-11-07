/**
 * Tests de `utils/platformAuth.ts` — el flujo de login WEB (Firebase
 * `signInWithPopup` para Google y Apple). Su contrapartida nativa está en
 * `platformAuthNative.test.ts`.
 *
 * Bajo Jest, un `import`/`require` de `@/utils/platformAuth` a secas resuelve
 * a `platformAuth.native.ts` (jest-expo prioriza `.native` sobre el fichero
 * sin sufijo, igual que Metro en un build nativo) — por eso aquí se carga
 * con la extensión `.ts` explícita, que sortea esa resolución y coge el
 * fichero web de verdad.
 *
 * Lo que importa: los scopes que se piden (profile/email para Google,
 * email/name para Apple), y que un fallo del popup salga ya normalizado
 * como `AuthError` (vía `toAuthError`, ya testeado en `authErrors.test.ts`).
 */
import { AUTH_ERROR } from '@/utils/authErrors';

const mockSignInWithPopup = jest.fn();
const addScopeCalls: { provider: string; scope: string }[] = [];

class MockGoogleAuthProvider {
  addScope(scope: string) {
    addScopeCalls.push({ provider: 'google', scope });
  }
}
class MockOAuthProvider {
  id: string;
  constructor(id: string) {
    this.id = id;
  }
  addScope(scope: string) {
    addScopeCalls.push({ provider: this.id, scope });
  }
}

jest.mock('firebase/auth', () => ({
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  GoogleAuthProvider: MockGoogleAuthProvider,
  OAuthProvider: MockOAuthProvider,
}));

// Carga explícita con extensión .ts — ver comentario de cabecera.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const platformAuth =
  require('@/utils/platformAuth.ts') as typeof import('@/utils/platformAuth');

const fakeAuth = {} as any;

beforeEach(() => {
  jest.clearAllMocks();
  addScopeCalls.length = 0;
});

describe('configuración (no-ops en web)', () => {
  it('configureGoogleSignIn y ensureGoogleSignInConfigured no hacen nada', async () => {
    await expect(platformAuth.configureGoogleSignIn()).resolves.toBeUndefined();
    await expect(
      platformAuth.ensureGoogleSignInConfigured(),
    ).resolves.toBeUndefined();
  });

  it('doGoogleSignOut no hace nada (el popup no deja sesión nativa que cerrar)', async () => {
    await expect(platformAuth.doGoogleSignOut()).resolves.toBeUndefined();
  });
});

describe('doGoogleSignIn', () => {
  it('pide los scopes profile+email y devuelve el resultado del popup', async () => {
    const result = { user: { uid: 'u1' } };
    mockSignInWithPopup.mockResolvedValue(result);
    await expect(platformAuth.doGoogleSignIn(fakeAuth)).resolves.toBe(result);
    expect(addScopeCalls).toEqual([
      { provider: 'google', scope: 'profile' },
      { provider: 'google', scope: 'email' },
    ]);
  });

  it('normaliza un fallo del popup a AuthError (cancelado)', async () => {
    mockSignInWithPopup.mockRejectedValue({
      code: 'auth/popup-closed-by-user',
    });
    await expect(platformAuth.doGoogleSignIn(fakeAuth)).rejects.toMatchObject({
      name: 'AuthError',
      code: AUTH_ERROR.CANCELLED,
    });
  });
});

describe('isAppleSignInAvailable', () => {
  it('siempre true en web (el popup de Firebase siempre está disponible)', async () => {
    await expect(platformAuth.isAppleSignInAvailable()).resolves.toBe(true);
  });
});

describe('doAppleSignIn', () => {
  it('pide los scopes email+name sobre un OAuthProvider("apple.com")', async () => {
    const result = { user: { uid: 'u2' } };
    mockSignInWithPopup.mockResolvedValue(result);
    await expect(platformAuth.doAppleSignIn(fakeAuth)).resolves.toBe(result);
    expect(addScopeCalls).toEqual([
      { provider: 'apple.com', scope: 'email' },
      { provider: 'apple.com', scope: 'name' },
    ]);
  });

  it('normaliza un fallo del popup a AuthError', async () => {
    mockSignInWithPopup.mockRejectedValue(new Error('red caída'));
    await expect(platformAuth.doAppleSignIn(fakeAuth)).rejects.toMatchObject({
      name: 'AuthError',
      code: AUTH_ERROR.UNKNOWN,
    });
  });
});

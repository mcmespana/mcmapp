/**
 * Tests de `AuthContext`: el estado de sesión (Google/Apple vía Firebase
 * Auth), y sobre todo `deleteAccount`, que borra primero el nodo RTDB del
 * usuario y luego la cuenta de Authentication, con reintento automático si
 * Firebase exige un login reciente. Un fallo aquí deja datos huérfanos en
 * RTDB o, peor, revienta el borrado sin avisar al usuario.
 *
 * Se mockean `firebase/auth`, `@/utils/firebaseAuth`, `@/utils/platformAuth`
 * y `@/utils/authHelpers` — ninguno de ellos habla con Firebase de verdad.
 */
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { getFirebaseAuth } from '@/utils/firebaseAuth';
import {
  doGoogleSignIn,
  doAppleSignIn,
  doGoogleSignOut,
} from '@/utils/platformAuth';
import { deleteUserData } from '@/utils/authHelpers';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

jest.mock('@/utils/firebaseAuth', () => ({
  getFirebaseAuth: jest.fn(),
}));
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
  signOut: jest.fn(() => Promise.resolve()),
  deleteUser: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/utils/platformAuth', () => ({
  configureGoogleSignIn: jest.fn(() => Promise.resolve()),
  doGoogleSignIn: jest.fn(),
  doAppleSignIn: jest.fn(),
  doGoogleSignOut: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/utils/authHelpers', () => ({
  deleteUserData: jest.fn(() => Promise.resolve()),
}));

const { deleteUser } = jest.requireMock('firebase/auth');

let onNext: (user: any) => void;
let onError: (err: any) => void;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

async function mount() {
  return renderHook(() => useAuth(), { wrapper });
}

beforeEach(() => {
  jest.clearAllMocks();
  (getFirebaseAuth as jest.Mock).mockReturnValue({ currentUser: null });
  (onAuthStateChanged as jest.Mock).mockImplementation(
    (_auth: unknown, next: any, error: any) => {
      onNext = next;
      onError = error;
      return jest.fn();
    },
  );
});

describe('estado de sesión', () => {
  it('arranca en loading mientras Firebase no ha contestado', async () => {
    const { result } = await mount();
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it('normaliza el AuthUser cuando Firebase emite un usuario de Google', async () => {
    const { result } = await mount();
    await act(async () =>
      onNext({
        uid: 'u1',
        email: 'ana@mcm.org',
        displayName: 'Ana',
        photoURL: 'https://x/y.png',
        providerData: [{ providerId: 'google.com' }],
      }),
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.user).toEqual({
      uid: 'u1',
      email: 'ana@mcm.org',
      displayName: 'Ana',
      photoURL: 'https://x/y.png',
      provider: 'google',
    });
  });

  it('detecta el proveedor Apple', async () => {
    const { result } = await mount();
    await act(async () =>
      onNext({
        uid: 'u2',
        email: null,
        displayName: null,
        photoURL: null,
        providerData: [{ providerId: 'apple.com' }],
      }),
    );
    expect(result.current.user?.provider).toBe('apple');
  });

  it('un proveedor desconocido cae a google por defecto', async () => {
    const { result } = await mount();
    await act(async () =>
      onNext({
        uid: 'u3',
        email: null,
        displayName: null,
        photoURL: null,
        providerData: [{ providerId: 'facebook.com' }],
      }),
    );
    expect(result.current.user?.provider).toBe('google');
  });

  it('firebaseUser null (logout) limpia el user', async () => {
    const { result } = await mount();
    await act(async () => onNext({ uid: 'u1', providerData: [] }));
    await act(async () => onNext(null));
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('un error de onAuthStateChanged se expone como configError', async () => {
    const { result } = await mount();
    await act(async () => onError({ message: 'permission-denied' }));
    expect(result.current.configError).toBe('permission-denied');
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('configError si getFirebaseAuth revienta al iniciar (Firebase mal configurado)', async () => {
    (getFirebaseAuth as jest.Mock).mockImplementation(() => {
      throw new Error('Missing FIREBASE_API_KEY');
    });
    const { result } = await mount();
    expect(result.current.configError).toBe('Missing FIREBASE_API_KEY');
    expect(result.current.loading).toBe(false);
    expect(onAuthStateChanged).not.toHaveBeenCalled();
  });
});

describe('signInWithGoogle', () => {
  it('devuelve el AuthUser normalizado en éxito', async () => {
    (doGoogleSignIn as jest.Mock).mockResolvedValue({
      user: {
        uid: 'u1',
        email: 'ana@mcm.org',
        displayName: 'Ana',
        photoURL: null,
      },
    });
    const { result } = await mount();
    let signed: any;
    await act(async () => {
      signed = await result.current.signInWithGoogle();
    });
    expect(signed).toEqual({
      uid: 'u1',
      email: 'ana@mcm.org',
      displayName: 'Ana',
      photoURL: null,
      provider: 'google',
    });
  });

  it('devuelve null si el usuario cancela el selector', async () => {
    (doGoogleSignIn as jest.Mock).mockRejectedValue({
      code: 'auth/popup-closed-by-user',
    });
    const { result } = await mount();
    let signed: any = 'not-called';
    await act(async () => {
      signed = await result.current.signInWithGoogle();
    });
    expect(signed).toBeNull();
  });

  it('propaga un error real para que la UI pueda avisar', async () => {
    (doGoogleSignIn as jest.Mock).mockRejectedValue(new Error('network down'));
    const { result } = await mount();
    await expect(result.current.signInWithGoogle()).rejects.toThrow(
      'network down',
    );
  });
});

describe('signInWithApple', () => {
  it('devuelve el AuthUser normalizado con provider apple', async () => {
    (doAppleSignIn as jest.Mock).mockResolvedValue({
      user: {
        uid: 'u9',
        email: 'ana@mcm.org',
        displayName: 'Ana',
        photoURL: null,
      },
    });
    const { result } = await mount();
    let signed: any;
    await act(async () => {
      signed = await result.current.signInWithApple();
    });
    expect(signed?.provider).toBe('apple');
  });
});

describe('signOut', () => {
  it('cierra la sesión nativa de Google y la de Firebase', async () => {
    const { result } = await mount();
    await act(async () => result.current.signOut());
    expect(doGoogleSignOut).toHaveBeenCalled();
    expect(firebaseSignOut).toHaveBeenCalled();
  });

  it('no revienta si el signOut nativo falla', async () => {
    (doGoogleSignOut as jest.Mock).mockRejectedValue(new Error('boom'));
    const { result } = await mount();
    await expect(act(async () => result.current.signOut())).resolves.not.toThrow();
  });
});

describe('deleteAccount', () => {
  function currentUser(overrides: Partial<any> = {}) {
    return {
      uid: 'u1',
      providerData: [{ providerId: 'google.com' }],
      ...overrides,
    };
  }

  it('sin sesión activa devuelve "error" sin tocar nada', async () => {
    (getFirebaseAuth as jest.Mock).mockReturnValue({ currentUser: null });
    const { result } = await mount();
    let outcome: any;
    await act(async () => {
      outcome = await result.current.deleteAccount();
    });
    expect(outcome).toBe('error');
    expect(deleteUserData).not.toHaveBeenCalled();
  });

  it('borra primero el nodo RTDB y luego la cuenta de Authentication', async () => {
    const user = currentUser();
    (getFirebaseAuth as jest.Mock).mockReturnValue({ currentUser: user });
    const { result } = await mount();
    let outcome: any;
    await act(async () => {
      outcome = await result.current.deleteAccount();
    });
    expect(outcome).toBe('success');
    expect(deleteUserData).toHaveBeenCalledWith('u1');
    expect(deleteUser).toHaveBeenCalledWith(user);
    expect(doGoogleSignOut).toHaveBeenCalled();
  });

  it('reautentica con Google y reintenta si Firebase pide un login reciente', async () => {
    const user = currentUser();
    (getFirebaseAuth as jest.Mock).mockReturnValue({ currentUser: user });
    (deleteUserData as jest.Mock)
      .mockRejectedValueOnce({ code: 'auth/requires-recent-login' })
      .mockResolvedValueOnce(undefined);
    (doGoogleSignIn as jest.Mock).mockResolvedValue({ user });
    const { result } = await mount();
    let outcome: any;
    await act(async () => {
      outcome = await result.current.deleteAccount();
    });
    expect(outcome).toBe('success');
    expect(doGoogleSignIn).toHaveBeenCalled();
    expect(deleteUserData).toHaveBeenCalledTimes(2);
  });

  it('reautentica con Apple cuando el proveedor de la cuenta es Apple', async () => {
    const user = currentUser({ providerData: [{ providerId: 'apple.com' }] });
    (getFirebaseAuth as jest.Mock).mockReturnValue({ currentUser: user });
    (deleteUserData as jest.Mock)
      .mockRejectedValueOnce({ code: 'auth/requires-recent-login' })
      .mockResolvedValueOnce(undefined);
    (doAppleSignIn as jest.Mock).mockResolvedValue({ user });
    const { result } = await mount();
    await act(async () => {
      await result.current.deleteAccount();
    });
    expect(doAppleSignIn).toHaveBeenCalled();
    expect(doGoogleSignIn).not.toHaveBeenCalled();
  });

  it('si el usuario cancela la reautenticación, devuelve "cancelled"', async () => {
    const user = currentUser();
    (getFirebaseAuth as jest.Mock).mockReturnValue({ currentUser: user });
    (deleteUserData as jest.Mock).mockRejectedValueOnce({
      code: 'auth/requires-recent-login',
    });
    (doGoogleSignIn as jest.Mock).mockRejectedValue({
      code: 'auth/popup-closed-by-user',
    });
    const { result } = await mount();
    let outcome: any;
    await act(async () => {
      outcome = await result.current.deleteAccount();
    });
    expect(outcome).toBe('cancelled');
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('si la reautenticación falla por otro motivo, devuelve "error"', async () => {
    const user = currentUser();
    (getFirebaseAuth as jest.Mock).mockReturnValue({ currentUser: user });
    (deleteUserData as jest.Mock).mockRejectedValueOnce({
      code: 'auth/requires-recent-login',
    });
    (doGoogleSignIn as jest.Mock).mockRejectedValue(new Error('network down'));
    const { result } = await mount();
    let outcome: any;
    await act(async () => {
      outcome = await result.current.deleteAccount();
    });
    expect(outcome).toBe('error');
  });

  it('si el reintento tras reautenticar vuelve a fallar, devuelve "error"', async () => {
    const user = currentUser();
    (getFirebaseAuth as jest.Mock).mockReturnValue({ currentUser: user });
    (deleteUserData as jest.Mock)
      .mockRejectedValueOnce({ code: 'auth/requires-recent-login' })
      .mockRejectedValueOnce(new Error('still failing'));
    (doGoogleSignIn as jest.Mock).mockResolvedValue({ user });
    const { result } = await mount();
    let outcome: any;
    await act(async () => {
      outcome = await result.current.deleteAccount();
    });
    expect(outcome).toBe('error');
  });

  it('cualquier otro error de borrado (sin requerir login reciente) devuelve "error"', async () => {
    const user = currentUser();
    (getFirebaseAuth as jest.Mock).mockReturnValue({ currentUser: user });
    (deleteUserData as jest.Mock).mockRejectedValueOnce(
      new Error('permission-denied'),
    );
    const { result } = await mount();
    let outcome: any;
    await act(async () => {
      outcome = await result.current.deleteAccount();
    });
    expect(outcome).toBe('error');
    expect(doGoogleSignIn).not.toHaveBeenCalled();
  });
});

describe('fuera del provider', () => {
  it('devuelve los defaults sin reventar', async () => {
    const { result } = await renderHook(() => useAuth());
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
    await expect(result.current.signOut()).resolves.toBeUndefined();
    await expect(result.current.deleteAccount()).resolves.toBe('error');
  });
});

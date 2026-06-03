import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  deleteUser,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/utils/firebaseAuth';
import {
  configureGoogleSignIn,
  doGoogleSignIn,
  doAppleSignIn,
  doGoogleSignOut,
} from '@/utils/platformAuth';
import { deleteUserData } from '@/utils/authHelpers';

/** Resultado de un intento de eliminación de cuenta. */
export type DeleteAccountResult = 'success' | 'cancelled' | 'error';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  provider: 'google' | 'apple';
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  /** Non-null when Firebase is misconfigured (bad/missing API key, etc.). */
  configError: string | null;
  signInWithGoogle: () => Promise<AuthUser | null>;
  signInWithApple: () => Promise<AuthUser | null>;
  signOut: () => Promise<void>;
  /** Elimina permanentemente la cuenta del usuario: borra sus datos en RTDB
   *  (`users/{uid}`) y la cuenta de Firebase Authentication. */
  deleteAccount: () => Promise<DeleteAccountResult>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  configError: null,
  signInWithGoogle: async () => null,
  signInWithApple: async () => null,
  signOut: async () => {},
  deleteAccount: async () => 'error',
});

function providerFromFirebase(firebaseUser: {
  providerData: { providerId: string }[];
}): 'google' | 'apple' {
  const pid = firebaseUser.providerData[0]?.providerId ?? '';
  if (pid.includes('apple')) return 'apple';
  // google.com, googleusercontent.com or any other provider defaults to google
  if (__DEV__ && !pid.includes('google')) {
    console.warn(
      `[AuthContext] Proveedor desconocido "${pid}", usando google por defecto`,
    );
  }
  return 'google';
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    configureGoogleSignIn().catch(() => {});
  }, []);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      const auth = getFirebaseAuth();
      unsub = onAuthStateChanged(
        auth,
        (firebaseUser) => {
          if (firebaseUser) {
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              provider: providerFromFirebase(firebaseUser),
            });
          } else {
            setUser(null);
          }
          setLoading(false);
        },
        (error: any) => {
          console.error('[AuthContext] onAuthStateChanged error:', error);
          setConfigError(error?.message ?? String(error));
          setUser(null);
          setLoading(false);
        },
      );
    } catch (error: any) {
      console.error('[AuthContext] Firebase Auth init failed:', error);
      setConfigError(error?.message ?? String(error));
      setUser(null);
      setLoading(false);
    }
    return () => unsub?.();
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const auth = getFirebaseAuth();
      const result = await doGoogleSignIn(auth);
      const fu = result.user;
      return {
        uid: fu.uid,
        email: fu.email,
        displayName: fu.displayName,
        photoURL: fu.photoURL,
        provider: 'google',
      };
    } catch (err: any) {
      // El usuario canceló el flujo — no es un error real
      const cancelled =
        err?.code === 'auth/cancelled-popup-request' ||
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'ERR_CANCELED';
      if (cancelled) return null;
      // Error real: propagar para que la UI muestre feedback (toast) en vez
      // de fallar en silencio.
      console.error('[AuthContext] signInWithGoogle:', err);
      throw err;
    }
  }, []);

  const signInWithApple = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const auth = getFirebaseAuth();
      const result = await doAppleSignIn(auth);
      const fu = result.user;
      return {
        uid: fu.uid,
        email: fu.email,
        displayName: fu.displayName,
        photoURL: fu.photoURL,
        provider: 'apple',
      };
    } catch (err: any) {
      const cancelled =
        err?.code === 'ERR_CANCELED' || String(err?.message).includes('cancel');
      if (cancelled) return null;
      console.error('[AuthContext] signInWithApple:', err);
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await doGoogleSignOut();
      await firebaseSignOut(getFirebaseAuth());
    } catch (err) {
      console.error('[AuthContext] signOut:', err);
    }
  }, []);

  const deleteAccount = useCallback(async (): Promise<DeleteAccountResult> => {
    const auth = getFirebaseAuth();
    const current = auth.currentUser;
    if (!current) return 'error';

    const provider = user?.provider ?? providerFromFirebase(current);

    // Borra primero el nodo RTDB (mientras la sesión sigue activa y con
    // permisos) y después la cuenta de Authentication.
    const runDelete = async () => {
      const u = auth.currentUser;
      if (!u) throw new Error('No current user');
      await deleteUserData(u.uid);
      await deleteUser(u);
    };

    try {
      await runDelete();
    } catch (err: any) {
      // Firebase exige un login reciente para borrar la cuenta. Si lo pide,
      // reautenticamos repitiendo el flujo del proveedor y reintentamos.
      if (err?.code === 'auth/requires-recent-login') {
        try {
          if (provider === 'apple') {
            await doAppleSignIn(auth);
          } else {
            await doGoogleSignIn(auth);
          }
        } catch (reauthErr: any) {
          const cancelled =
            reauthErr?.code === 'ERR_CANCELED' ||
            reauthErr?.code === 'auth/popup-closed-by-user' ||
            reauthErr?.code === 'auth/cancelled-popup-request' ||
            String(reauthErr?.message ?? '').includes('cancel');
          return cancelled ? 'cancelled' : 'error';
        }
        try {
          await runDelete();
        } catch (retryErr) {
          console.error('[AuthContext] deleteAccount retry:', retryErr);
          return 'error';
        }
      } else {
        console.error('[AuthContext] deleteAccount:', err);
        return 'error';
      }
    }

    // Limpia la sesión nativa de Google (si la hubiera).
    try {
      await doGoogleSignOut();
    } catch {
      // Ignorar — la cuenta ya está eliminada.
    }

    return 'success';
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        configError,
        signInWithGoogle,
        signInWithApple,
        signOut,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

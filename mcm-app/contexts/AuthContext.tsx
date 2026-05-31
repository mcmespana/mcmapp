import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { getFirebaseAuth } from '@/utils/firebaseAuth';
import {
  configureGoogleSignIn,
  doGoogleSignIn,
  doAppleSignIn,
  doGoogleSignOut,
} from '@/utils/platformAuth';

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
  signInWithGoogle: () => Promise<AuthUser | null>;
  signInWithApple: () => Promise<AuthUser | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => null,
  signInWithApple: async () => null,
  signOut: async () => {},
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
        (error) => {
          // Auth error (e.g. auth/invalid-api-key) — fail gracefully so the
          // rest of the app (cantoral, calendar, etc.) keeps working.
          console.error('[AuthContext] onAuthStateChanged error:', error);
          setUser(null);
          setLoading(false);
        },
      );
    } catch (error) {
      console.error('[AuthContext] Firebase Auth init failed:', error);
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
      if (!cancelled) {
        console.error('[AuthContext] signInWithGoogle:', err);
      }
      return null;
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
      if (!cancelled) {
        console.error('[AuthContext] signInWithApple:', err);
      }
      return null;
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

  return (
    <AuthContext.Provider
      value={{ user, loading, signInWithGoogle, signInWithApple, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

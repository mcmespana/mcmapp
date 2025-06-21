import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getAuth, onAuthStateChanged, signOut, signInWithCredential, GoogleAuthProvider, User } from 'firebase/auth';
import { getDatabase, ref, get, set, update } from 'firebase/database';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { getFirebaseApp } from '@/hooks/firebaseApp';

WebBrowser.maybeCompleteAuthSession();

interface UserProfile {
  location: string | null;
  admin: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  signInWithGoogle: () => void;
  signOutUser: () => void;
  setLocation: (loc: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const auth = getAuth(getFirebaseApp());
  const db = getDatabase(getFirebaseApp());
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const snap = await get(ref(db, `users/${u.uid}`));
        if (snap.exists()) {
          setProfile(snap.val());
        } else {
          const data: UserProfile = { location: null, admin: false };
          await set(ref(db, `users/${u.uid}`), {
            email: u.email,
            displayName: u.displayName,
            ...data,
          });
          setProfile(data);
        }
      } else {
        setProfile(null);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params as any;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential).catch(console.error);
    }
  }, [response]);

  const signInWithGoogle = () => {
    promptAsync().catch(console.error);
  };

  const signOutUser = () => signOut(auth);

  const setLocation = async (loc: string) => {
    if (!user) return;
    await update(ref(db, `users/${user.uid}`), { location: loc });
    setProfile((p) => (p ? { ...p, location: loc } : p));
  };

  return (
    <AuthContext.Provider value={{ user, profile, signInWithGoogle, signOutUser, setLocation }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getAuth, onAuthStateChanged, signOut, signInWithCredential, GoogleAuthProvider, OAuthProvider, User } from 'firebase/auth';
import { getDatabase, ref, get, set, update } from 'firebase/database';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';

import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { getFirebaseApp } from '../hooks/firebaseApp';

WebBrowser.maybeCompleteAuthSession();

interface UserProfile {
  profile: string | null;
  admin: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  signInWithGoogle: () => void;
  signInWithApple: () => void;
  signOutUser: () => void;
  setProfile: (p: string) => Promise<void>;
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

  const enableApple = process.env.EXPO_PUBLIC_ENABLE_APPLE_SIGNIN === 'true';

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const snap = await get(ref(db, `users/${u.uid}`));
        if (snap.exists()) {
          setProfile(snap.val());
        } else {
          const data: UserProfile = { profile: null, admin: false };
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

  const signInWithApple = async () => {
    if (!enableApple) return;
    if (Platform.OS !== 'ios') {
      console.warn('Apple Sign-In solo está disponible en dispositivos iOS.');
      return;
    }
    try {
      const result = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (result.identityToken) {
        const provider = new OAuthProvider('apple.com');
        const cred = provider.credential({ idToken: result.identityToken });
        await signInWithCredential(auth, cred);
      }
    } catch (e: any) {
      if (e.code !== 'ERR_CANCELED') console.error(e);
    }
  };
  const signOutUser = () => signOut(auth);

  const setProfileValue = async (pVal: string) => {
    if (!user) return;
    await update(ref(db, `users/${user.uid}`), { profile: pVal });
    setProfile((p) => (p ? { ...p, profile: pVal } : p));
  };


  return (
    <AuthContext.Provider value={{ user, profile, signInWithGoogle, signInWithApple, signOutUser, setProfile: setProfileValue }}>

      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

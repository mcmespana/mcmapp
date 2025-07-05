import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getAuth, onAuthStateChanged, signInWithCredential, signOut as firebaseSignOut, User, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { getDatabase, ref, set } from 'firebase/database';
import { getFirebaseApp } from '@/hooks/firebaseApp';
import { useAppSettings } from './AppSettingsContext';

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const auth = getAuth(getFirebaseApp());
  const { settings } = useAppSettings();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      console.log('Auth state changed', u?.uid);
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params as any;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential)
        .then((cred) => saveUser(cred.user))
        .catch((e) => console.error('Google sign in error', e));
    }
  }, [response]);

  const saveUser = async (u: User) => {
    const db = getDatabase(getFirebaseApp());
    const data = {
      admin: false,
      displayName: u.displayName ?? '',
      email: u.email ?? '',
      profile: settings.profile,
    };
    console.log('Saving user profile', data);
    await set(ref(db, `users/${u.uid}`), data);
  };

  const signInWithGoogle = async () => {
    await promptAsync();
  };

  const signInWithApple = async () => {
    try {
      if (Platform.OS !== 'ios') return;
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const provider = new OAuthProvider('apple.com');
      const firebaseCred = provider.credential({ idToken: credential.identityToken });
      const res = await signInWithCredential(auth, firebaseCred);
      await saveUser(res.user);
    } catch (e) {
      console.error('Apple sign in error', e);
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithApple, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

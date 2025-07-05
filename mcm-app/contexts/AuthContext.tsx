import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Platform } from 'react-native';
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import { getDatabase, ref, set, get } from 'firebase/database';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { getRemoteConfig, fetchAndActivate, getValue } from 'firebase/remote-config';
import { getFirebaseApp } from '@/hooks/firebaseApp';

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  user: User | null;
  loading: boolean;
  profiles: string[];
  profile: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  setProfile: (profile: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<string[]>([]);
  const [profile, setProfileState] = useState<string | null>(null);
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
  });

  useEffect(() => {
    const auth = getAuth(getFirebaseApp());
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) loadProfile(u.uid);
    });
    return unsub;
  }, []);

  useEffect(() => {
    async function loadProfiles() {
      try {
        const rc = getRemoteConfig(getFirebaseApp());
        rc.settings.minimumFetchIntervalMillis = 3600000;
        await fetchAndActivate(rc);
        const json = getValue(rc, 'profile').asString();
        const arr = JSON.parse(json);
        if (Array.isArray(arr)) setProfiles(arr);
      } catch (e) {
        console.log('Failed loading profiles', e);
      }
    }
    loadProfiles();
  }, []);

  async function loadProfile(uid: string) {
    try {
      const db = getDatabase(getFirebaseApp());
      const snapshot = await get(ref(db, `users/${uid}/profile`));
      if (snapshot.exists()) setProfileState(snapshot.val());
    } catch (e) {
      console.log('Failed loading user profile', e);
    }
  }

  async function saveProfile(uid: string, p: string) {
    try {
      const db = getDatabase(getFirebaseApp());
      await set(ref(db, `users/${uid}/profile`), p);
      setProfileState(p);
    } catch (e) {
      console.log('Failed saving profile', e);
    }
  }

  async function signInWithGoogle() {
    try {
      const auth = getAuth(getFirebaseApp());
      if (Platform.OS === 'web') {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        if (result.user) await ensureUserData(result.user);
        return;
      }
      const res = await promptAsync();
      if (res?.type === 'success') {
        const { id_token } = res.params as any;
        const credential = GoogleAuthProvider.credential(id_token);
        const result = await signInWithCredential(auth, credential);
        if (result.user) await ensureUserData(result.user);
      }
    } catch (e) {
      console.log('Google sign-in error', e);
    }
  }

  async function signInWithApple() {
    try {
      const auth = getAuth(getFirebaseApp());
      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const provider = new OAuthProvider('apple.com');
      const credential = provider.credential({ idToken: appleCredential.identityToken ?? '' });
      const result = await signInWithCredential(auth, credential);
      if (result.user) await ensureUserData(result.user);
    } catch (e) {
      console.log('Apple sign-in error', e);
    }
  }

  async function ensureUserData(u: User) {
    try {
      const db = getDatabase(getFirebaseApp());
      await set(ref(db, `users/${u.uid}`), {
        admin: false,
        displayName: u.displayName ?? '',
        email: u.email ?? '',
        profile: profile ?? profiles[0] ?? 'MCM Nacional',
      });
    } catch (e) {
      console.log('Failed saving user data', e);
    }
  }

  async function signOut() {
    try {
      const auth = getAuth(getFirebaseApp());
      await firebaseSignOut(auth);
      setUser(null);
      setProfileState(null);
    } catch (e) {
      console.log('Sign out error', e);
    }
  }

  const contextValue: AuthContextType = {
    user,
    loading,
    profiles,
    profile,
    signInWithGoogle,
    signInWithApple,
    signOut,
    setProfile: async (p: string) => {
      if (user) await saveProfile(user.uid, p);
    },
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

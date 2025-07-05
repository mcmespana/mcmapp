import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import {
  onAuthStateChanged,
  signInWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import { ref, set, get } from 'firebase/database';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { auth, db, remoteConfig } from '@/utils/firebase';
import { fetchAndActivate, getValue } from 'firebase/remote-config';

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  user: User | null;
  profile: string;
  profiles: string[];
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  setProfile: (profile: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfileState] = useState('');
  const [profiles, setProfiles] = useState<string[]>([]);

  const [googleRequest, , promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (usr) => {
      setUser(usr);
      if (usr) {
        const snap = await get(ref(db, `users/${usr.uid}/profile`));
        if (snap.exists()) setProfileState(String(snap.val()));
      } else {
        setProfileState('');
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const loadProfiles = async () => {
      try {
        remoteConfig.settings = { minimumFetchIntervalMillis: 0 } as any;
        await fetchAndActivate(remoteConfig);
        const value = getValue(remoteConfig, 'profile').asString();
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) setProfiles(parsed);
      } catch (e) {
        console.log('Failed fetching profiles', e);
      }
    };
    loadProfiles();
  }, []);

  const updateUserNode = async (prof: string) => {
    if (!user) return;
    await set(ref(db, `users/${user.uid}`), {
      admin: false,
      displayName: user.displayName,
      email: user.email,
      profile: prof,
    });
  };

  const signInWithGoogle = async () => {
    try {
      const resp = await promptAsync();
      if (resp?.type === 'success') {
        const credential = GoogleAuthProvider.credential(resp.params.id_token);
        await signInWithCredential(auth, credential);
      }
    } catch (e) {
      console.log('Google sign in error', e);
    }
  };

  const signInWithApple = async () => {
    if (Platform.OS !== 'ios') return;
    try {
      const appleAuth = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        ],
      });
      if (appleAuth.identityToken) {
        const provider = new OAuthProvider('apple.com');
        const credential = provider.credential({
          idToken: appleAuth.identityToken,
        });
        await signInWithCredential(auth, credential);
      }
    } catch (e) {
      console.log('Apple sign in error', e);
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setProfileState('');
  };

  const setProfile = async (prof: string) => {
    setProfileState(prof);
    await updateUserNode(prof);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        profiles,
        signInWithGoogle,
        signInWithApple,
        signOut,
        setProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

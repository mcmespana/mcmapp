import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProfileType } from '@/types/profileConfig';

export interface UserProfile {
  name: string;
  profileType: ProfileType | null;
  delegationId: string | null;
  onboardingCompleted: boolean;
}

interface UserProfileContextType {
  profile: UserProfile;
  setProfile: (values: Partial<UserProfile>) => void;
  loading: boolean;
}

const defaultProfile: UserProfile = {
  name: '',
  profileType: null,
  delegationId: null,
  onboardingCompleted: false,
};
const STORAGE_KEY = '@user_profile';

const UserProfileContext = createContext<UserProfileContextType | undefined>(
  undefined,
);

export const UserProfileProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [profile, setProfileState] = useState<UserProfile>(defaultProfile);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await AsyncStorage.getItem(STORAGE_KEY);
        if (data) {
          const parsed = JSON.parse(data);
          setProfileState((prev) => ({
            ...prev,
            name: parsed.name ?? '',
            profileType: parsed.profileType ?? null,
            delegationId: parsed.delegationId ?? null,
            onboardingCompleted: parsed.onboardingCompleted === true,
          }));
        }
      } catch (e) {
        console.error('Failed loading user profile', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (loading) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile)).catch((e) =>
      console.error('Failed saving user profile', e),
    );
  }, [profile, loading]);

  const update = (values: Partial<UserProfile>) => {
    setProfileState((prev) => ({ ...prev, ...values }));
  };

  return (
    <UserProfileContext.Provider
      value={{ profile, setProfile: update, loading }}
    >
      {children}
    </UserProfileContext.Provider>
  );
};

export const useUserProfile = () => {
  const ctx = useContext(UserProfileContext);
  if (!ctx)
    throw new Error('useUserProfile must be used within UserProfileProvider');
  return ctx;
};

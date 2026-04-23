import React, { createContext, useContext, ReactNode } from 'react';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import type { ProfileConfigData } from '@/types/profileConfig';
import { DEFAULT_PROFILE_CONFIG_DATA } from '@/constants/defaultProfileConfig';

interface ProfileConfigContextType {
  rawConfig: ProfileConfigData;
  loading: boolean;
  offline: boolean;
}

const ProfileConfigContext = createContext<ProfileConfigContextType>({
  rawConfig: DEFAULT_PROFILE_CONFIG_DATA,
  loading: false,
  offline: false,
});

/**
 * Descarga `/profileConfig` de Firebase usando el patrón estándar (caché en
 * AsyncStorage + comparación de updatedAt). Si no hay caché y no hay red, se
 * usa el fallback hardcoded (`DEFAULT_PROFILE_CONFIG_DATA`).
 *
 * Latencia: los cambios remotos se aplican la próxima vez que se abra la app.
 */
export const ProfileConfigProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { data, loading, offline } = useFirebaseData<ProfileConfigData>(
    'profileConfig',
    '@profileConfig',
  );

  const rawConfig = data ?? DEFAULT_PROFILE_CONFIG_DATA;

  return (
    <ProfileConfigContext.Provider value={{ rawConfig, loading, offline }}>
      {children}
    </ProfileConfigContext.Provider>
  );
};

export const useProfileConfigContext = () => useContext(ProfileConfigContext);

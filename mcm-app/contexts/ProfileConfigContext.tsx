import React, { createContext, useContext, useMemo, ReactNode } from 'react';
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
 * Verifica que el documento remoto tenga la forma mínima esperada. Una
 * config corrupta podría tirar la app vía resolver, así que la rechazamos
 * de raíz y caemos al fallback hardcoded.
 */
function isValidProfileConfig(value: unknown): value is ProfileConfigData {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (!v.global || typeof v.global !== 'object') return false;
  if (!v.profiles || typeof v.profiles !== 'object') return false;
  // Al menos debe existir un perfil base (familia / monitor / miembro).
  const profiles = v.profiles as Record<string, unknown>;
  if (Object.keys(profiles).length === 0) return false;
  if (!v.delegations || typeof v.delegations !== 'object') return false;
  if (!Array.isArray(v.delegationList)) return false;
  return true;
}

/**
 * Descarga `/profileConfig` de Firebase usando el patrón estándar (caché en
 * AsyncStorage + comparación de updatedAt). Si no hay caché y no hay red, o
 * si la config remota está malformada, se usa el fallback hardcoded
 * (`DEFAULT_PROFILE_CONFIG_DATA`).
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

  const rawConfig = useMemo<ProfileConfigData>(() => {
    if (isValidProfileConfig(data)) return data;
    if (data != null && typeof __DEV__ !== 'undefined' && __DEV__) {
      // eslint-disable-next-line no-console
      console.warn(
        '[profileConfig] Documento remoto inválido. Usando fallback hardcoded.',
      );
    }
    return DEFAULT_PROFILE_CONFIG_DATA;
  }, [data]);

  const value = useMemo(
    () => ({ rawConfig, loading, offline }),
    [rawConfig, loading, offline],
  );

  return (
    <ProfileConfigContext.Provider value={value}>
      {children}
    </ProfileConfigContext.Provider>
  );
};

export const useProfileConfigContext = () => useContext(ProfileConfigContext);

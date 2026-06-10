import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import type {
  Delegation,
  DelegationListItem,
  ProfileConfigData,
} from '@/types/profileConfig';
import { DEFAULT_PROFILE_CONFIG_DATA } from '@/constants/defaultProfileConfig';

interface ProfileConfigContextType {
  rawConfig: ProfileConfigData;
  loading: boolean;
  offline: boolean;
}

/**
 * `delegations` es la única fuente de verdad para la lista de delegaciones.
 * Esta función deriva la lista visible (excluyendo `_default`, que es la
 * pseudo-delegación general) en el orden de inserción del objeto. Evita la
 * duplicación entre `delegations` y `delegationList` que existía antes.
 */
function deriveDelegationList(
  delegations: Record<string, Delegation>,
): DelegationListItem[] {
  return Object.entries(delegations)
    .filter(([id]) => id !== '_default')
    .map(([id, d]) => ({ id, label: d.label }));
}

function withDerivedDelegationList(data: ProfileConfigData): ProfileConfigData {
  return { ...data, delegationList: deriveDelegationList(data.delegations) };
}

const ProfileConfigContext = createContext<ProfileConfigContextType>({
  rawConfig: withDerivedDelegationList(DEFAULT_PROFILE_CONFIG_DATA),
  loading: false,
  offline: false,
});

/**
 * Verifica que el documento remoto tenga la forma mínima esperada. Una
 * config corrupta podría tirar la app vía resolver, así que la rechazamos
 * de raíz y caemos al fallback hardcoded.
 *
 * `delegationList` ya no se exige aquí: el cliente lo deriva siempre desde
 * `delegations` para evitar tener dos fuentes que se desincronicen.
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
    if (isValidProfileConfig(data)) return withDerivedDelegationList(data);
    if (data != null && typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn(
        '[profileConfig] Documento remoto inválido. Usando fallback hardcoded.',
      );
    }
    return withDerivedDelegationList(DEFAULT_PROFILE_CONFIG_DATA);
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

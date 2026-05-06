import { useMemo } from 'react';
import { useProfileConfigContext } from '@/contexts/ProfileConfigContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { resolveProfileConfig } from '@/utils/resolveProfileConfig';
import type { ResolvedProfileConfig } from '@/types/profileConfig';
import { DEFAULT_PROFILE_TYPE } from '@/constants/defaultProfileConfig';

/**
 * Hook puro que combina la config remota (`ProfileConfigContext`) con el perfil
 * del usuario (`UserProfileContext`) y devuelve la `ResolvedProfileConfig`
 * final, memoizada. Rompe el ciclo entre providers sin necesidad de anidarlos.
 *
 * Si el usuario aún no ha completado el onboarding, asumimos `miembro` +
 * `_default` (mismo comportamiento que saltar el onboarding).
 */
export function useResolvedProfileConfig(): ResolvedProfileConfig {
  const { rawConfig } = useProfileConfigContext();
  const { profile } = useUserProfile();

  return useMemo(() => {
    const profileType = profile.profileType ?? DEFAULT_PROFILE_TYPE;
    const delegationId = profile.delegationId;
    return resolveProfileConfig(rawConfig, profileType, delegationId);
  }, [rawConfig, profile.profileType, profile.delegationId]);
}

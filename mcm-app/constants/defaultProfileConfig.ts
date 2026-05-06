// Fallback hardcoded para el Sistema de Perfiles.
//
// Se importa el mismo JSON que se sube a Firebase (`firebase-seed/profileConfig.json`)
// para garantizar que fallback y config remota inicial están sincronizados.
//
// Uso:
// - Primera carga sin caché y sin conexión → `DEFAULT_PROFILE_CONFIG_DATA`.
// - Tipo por defecto si el usuario salta el onboarding → `miembro` sin delegación.

import profileConfigSeed from '@/firebase-seed/profileConfig.json';
import type {
  ProfileConfigData,
  ProfileConfigDocument,
  ProfileType,
} from '@/types/profileConfig';

/** Solo el nodo `data` — suele ser lo que necesita el resolver y los consumidores. */
export const DEFAULT_PROFILE_CONFIG_DATA: ProfileConfigData = (
  profileConfigSeed as unknown as ProfileConfigDocument
).data;

/** Perfil por defecto si el usuario salta el onboarding. */
export const DEFAULT_PROFILE_TYPE: ProfileType = 'miembro';

/** Delegación por defecto (usa la entrada `_default` de `delegations`). */
export const DEFAULT_DELEGATION_ID = '_default';

// Fallback hardcoded para el Sistema de Perfiles.
//
// Se importa el mismo JSON que se sube a Firebase (`firebase-seed/profileConfig.json`)
// para garantizar que fallback y config remota inicial están sincronizados.
//
// Uso:
// - Primera carga sin caché y sin conexión → `DEFAULT_PROFILE_CONFIG_DATA`.
// - Tipo por defecto si el usuario salta el onboarding → `miembro` sin delegación.

import profileConfigSeed from '@/firebase-seed/profileConfig.json';
import { resolveProfileConfig } from '@/utils/resolveProfileConfig';
import type {
  ProfileConfigData,
  ProfileConfigDocument,
  ProfileType,
  ResolvedProfileConfig,
} from '@/types/profileConfig';

/** Documento Firebase completo ({ updatedAt, data }). */
export const DEFAULT_PROFILE_CONFIG_DOCUMENT: ProfileConfigDocument =
  profileConfigSeed as unknown as ProfileConfigDocument;

/** Solo el nodo `data` — suele ser lo que necesita el resolver y los consumidores. */
export const DEFAULT_PROFILE_CONFIG_DATA: ProfileConfigData =
  DEFAULT_PROFILE_CONFIG_DOCUMENT.data;

/** Perfil por defecto si el usuario salta el onboarding. */
export const DEFAULT_PROFILE_TYPE: ProfileType = 'miembro';

/** Delegación por defecto (usa la entrada `_default` de `delegations`). */
export const DEFAULT_DELEGATION_ID = '_default';

/**
 * Config resuelta lista para renderizar antes de que cargue nada remoto.
 * Equivalente a `miembro` + sin delegación contra el seed.
 */
export const DEFAULT_RESOLVED_PROFILE_CONFIG: ResolvedProfileConfig =
  resolveProfileConfig(
    DEFAULT_PROFILE_CONFIG_DATA,
    DEFAULT_PROFILE_TYPE,
    DEFAULT_DELEGATION_ID,
  );

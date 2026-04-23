// Tipos del sistema de perfiles de usuario (profileConfig).
// Ver docs: mcm-app/TODO_SISTEMA_PERFILES.md

export type ProfileType = 'familia' | 'monitor' | 'miembro';

export const PROFILE_TYPES: readonly ProfileType[] = [
  'familia',
  'monitor',
  'miembro',
] as const;

/**
 * Configuración base de un perfil. Todos los arrays son IDs que referencian
 * entidades existentes en la app (ver `constants/profileCatalog.ts`).
 */
export interface ProfileBase {
  label: string;
  description: string;
  tabs: string[];
  homeButtons: string[];
  masItems: string[];
  defaultCalendars: string[];
  albumTags: string[];
  notificationTopics: string[];
}

/**
 * Configuración por delegación. Los campos `extraX` son aditivos (se concatenan
 * con los del perfil); `override` reemplaza campos enteros del perfil base para
 * toda delegación (cualquier perfil).
 */
export interface Delegation {
  label: string;
  notificationTopic?: string;
  extraCalendars?: string[];
  extraHomeButtons?: string[];
  extraMasItems?: string[];
  extraAlbumTags?: string[];
  extraTabs?: string[];
  override?: Partial<ProfileBase>;
}

export interface DelegationListItem {
  id: string;
  label: string;
}

/**
 * Config global: flags que aplican a todos los perfiles por igual. Reemplaza al
 * antiguo `constants/featureFlags.ts`.
 */
export interface GlobalConfig {
  /** Tab inicial (id dentro de tabs). */
  defaultTab: string;
  /** Si se muestra el icono de notificaciones en el header de Home. */
  showNotificationsIcon: boolean;
  /** Si el onboarding se muestra en primer arranque. Si es false, la app asume valores por defecto. */
  showOnboarding: boolean;
  /** Si aparece el botón de cambiar nombre (legacy, puede quedar oculto). */
  showChangeNameButton: boolean;
  /** Si está activo, la app bloquea con mensaje de mantenimiento. */
  maintenanceMode: boolean;
  /** Mensaje opcional mostrado durante mantenimiento. */
  maintenanceMessage?: string;
  /** Versión semver mínima soportada. Si la app es inferior, fuerza actualización. `0.0.0` = sin bloqueo. */
  minAppVersion: string;
}

/**
 * Clave de override específico para combinaciones "<perfil>:<delegacion>".
 * Los campos aquí reemplazan a los del perfil base para esa combinación concreta.
 */
export type OverrideKey = `${ProfileType}:${string}`;

/**
 * Documento plano bajo `/profileConfig/data` en Firebase RTDB.
 */
export interface ProfileConfigData {
  global: GlobalConfig;
  profiles: Record<ProfileType, ProfileBase>;
  delegations: Record<string, Delegation> & { _default: Delegation };
  delegationList: DelegationListItem[];
  overrides?: Partial<Record<OverrideKey, Partial<ProfileBase>>>;
}

/**
 * Nodo completo tal y como vive en Firebase: `{ updatedAt, data }`.
 */
export interface ProfileConfigDocument {
  updatedAt: string;
  data: ProfileConfigData;
}

/**
 * Resultado final de resolver perfil + delegación contra la config. Es lo que
 * consume la UI a través de `useResolvedProfileConfig()`.
 */
export interface ResolvedProfileConfig {
  // --- global ---
  defaultTab: string;
  showNotificationsIcon: boolean;
  showOnboarding: boolean;
  showChangeNameButton: boolean;
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  minAppVersion: string;
  // --- identidad resuelta ---
  profileType: ProfileType;
  delegationId: string;
  delegationLabel: string;
  profileLabel: string;
  // --- perfil + delegación merged ---
  tabs: string[];
  homeButtons: string[];
  masItems: string[];
  defaultCalendars: string[];
  albumTags: string[];
  notificationTopics: string[];
}

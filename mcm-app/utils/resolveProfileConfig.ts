import type {
  Delegation,
  ProfileBase,
  ProfileConfigData,
  ProfileType,
  ResolvedProfileConfig,
} from '@/types/profileConfig';

declare const __DEV__: boolean;
import {
  KNOWN_ALBUM_TAGS,
  KNOWN_HOME_BUTTONS,
  KNOWN_MAS_ITEMS,
  KNOWN_TABS,
} from '@/constants/profileCatalog';

const DEFAULT_DELEGATION_ID = '_default';

const ARRAY_FIELDS: ReadonlyArray<keyof ProfileBase> = [
  'tabs',
  'homeButtons',
  'masItems',
  'defaultCalendars',
  'albumTags',
  'notificationTopics',
];

const CATALOGS: Partial<Record<keyof ProfileBase, readonly string[]>> = {
  tabs: KNOWN_TABS,
  homeButtons: KNOWN_HOME_BUTTONS,
  masItems: KNOWN_MAS_ITEMS,
  albumTags: KNOWN_ALBUM_TAGS,
  // notificationTopics NO se valida contra catálogo: las delegaciones añaden
  //   topics propios (ej. "castellon") que no aparecen en KNOWN_NOTIFICATION_TOPICS
  //   pero deben llegar a /pushTokens.topics para que el backend pueda segmentar.
  //   Se mantienen únicos sin filtrar.
  // defaultCalendars no se valida — los IDs vienen del nodo /jubileo/calendarios.
};

function uniq<T>(arr: readonly T[]): T[] {
  return Array.from(new Set(arr));
}

function warn(message: string) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.warn(`[profileConfig] ${message}`);
  }
}

/**
 * Filtra un array de IDs contra un catálogo conocido. IDs desconocidos se
 * descartan con warning. Si todo queda vacío, devuelve el fallback (útil para
 * no dejar la app con 0 tabs visibles).
 */
function sanitizeArray(
  field: keyof ProfileBase,
  values: readonly string[],
  fallback: readonly string[],
): string[] {
  const catalog = CATALOGS[field];
  if (!catalog) return uniq(values);

  const result: string[] = [];
  for (const value of values) {
    if ((catalog as readonly string[]).includes(value)) {
      result.push(value);
    } else {
      warn(`ID desconocido en '${field}': '${value}'. Se ignora.`);
    }
  }
  return result.length > 0 ? uniq(result) : uniq(fallback);
}

/**
 * Aplica un parcial de ProfileBase sobre un objeto base: cualquier campo
 * presente en el parcial reemplaza al del base (los arrays también).
 */
function applyOverride(
  base: ProfileBase,
  patch?: Partial<ProfileBase>,
): ProfileBase {
  if (!patch) return base;
  return { ...base, ...patch };
}

/**
 * Resuelve la configuración final para un usuario dado un perfil y delegación.
 *
 * Orden de merge (cada paso sobreescribe / enriquece al anterior):
 *   1. Perfil base (profiles[profileType])
 *   2. Delegación: campos `extraX` → concat; `override` → reemplaza
 *   3. Override específico de la combinación `"profileType:delegationId"`
 *   4. Sanitización contra catálogo conocido
 */
const FALLBACK_PROFILE: ProfileBase = {
  label: '',
  description: '',
  tabs: [...KNOWN_TABS],
  homeButtons: [...KNOWN_HOME_BUTTONS],
  masItems: [...KNOWN_MAS_ITEMS],
  defaultCalendars: [],
  albumTags: ['all'],
  notificationTopics: ['general'],
};

const FALLBACK_DELEGATION: Delegation = { label: 'General' };

export function resolveProfileConfig(
  config: ProfileConfigData,
  profileType: ProfileType,
  delegationId: string | null,
): ResolvedProfileConfig {
  // Tolerancia a config remota corrupta: si el perfil pedido no existe,
  // intentamos otro perfil válido del documento; si tampoco hay, usamos
  // FALLBACK_PROFILE para no dejar la app vacía.
  const profilesMap =
    config.profiles ?? ({} as Record<ProfileType, ProfileBase>);
  let profile = profilesMap[profileType];
  if (!profile) {
    warn(
      `Perfil '${profileType}' no presente en config remota. Usando primer perfil disponible.`,
    );
    const firstKey = Object.keys(profilesMap)[0] as ProfileType | undefined;
    profile = (firstKey && profilesMap[firstKey]) || FALLBACK_PROFILE;
  }

  const delegationsMap =
    config.delegations ?? ({} as Record<string, Delegation>);
  const resolvedDelegationId = delegationId ?? DEFAULT_DELEGATION_ID;
  const delegation: Delegation =
    delegationsMap[resolvedDelegationId] ??
    delegationsMap[DEFAULT_DELEGATION_ID] ??
    FALLBACK_DELEGATION;

  // 1. Perfil base (clonado, defendiendo contra arrays ausentes)
  let merged: ProfileBase = {
    label: profile.label ?? '',
    description: profile.description ?? '',
    tabs: [...(profile.tabs ?? [])],
    homeButtons: [...(profile.homeButtons ?? [])],
    masItems: [...(profile.masItems ?? [])],
    defaultCalendars: [...(profile.defaultCalendars ?? [])],
    albumTags: [...(profile.albumTags ?? [])],
    notificationTopics: [...(profile.notificationTopics ?? [])],
  };

  // 2a. Delegación: extras aditivos
  if (delegation) {
    if (delegation.extraTabs) {
      merged.tabs = uniq([...merged.tabs, ...delegation.extraTabs]);
    }
    if (delegation.extraHomeButtons) {
      merged.homeButtons = uniq([
        ...merged.homeButtons,
        ...delegation.extraHomeButtons,
      ]);
    }
    if (delegation.extraMasItems) {
      merged.masItems = uniq([...merged.masItems, ...delegation.extraMasItems]);
    }
    if (delegation.extraCalendars) {
      merged.defaultCalendars = uniq([
        ...merged.defaultCalendars,
        ...delegation.extraCalendars,
      ]);
    }
    if (delegation.extraAlbumTags) {
      merged.albumTags = uniq([
        ...merged.albumTags,
        ...delegation.extraAlbumTags,
      ]);
    }
    if (delegation.notificationTopic) {
      merged.notificationTopics = uniq([
        ...merged.notificationTopics,
        delegation.notificationTopic,
      ]);
    }
    // 2b. Delegación: override (reemplaza campos enteros)
    merged = applyOverride(merged, delegation.override);
  }

  // 3. Override específico perfil:delegación
  const overrideKey = `${profileType}:${resolvedDelegationId}` as const;
  const specificOverride = config.overrides?.[overrideKey];
  merged = applyOverride(merged, specificOverride);

  // 4. Sanitización contra catálogo
  for (const field of ARRAY_FIELDS) {
    const sanitized = sanitizeArray(
      field,
      (merged[field] as string[]) ?? [],
      (profile[field] as string[]) ?? [],
    );
    (merged[field] as string[]) = sanitized;
  }

  const global = config.global ?? ({} as ProfileConfigData['global']);
  return {
    // global
    defaultTab: global.defaultTab ?? 'index',
    showNotificationsIcon: global.showNotificationsIcon ?? true,
    showOnboarding: global.showOnboarding ?? true,
    showChangeNameButton: global.showChangeNameButton ?? false,
    maintenanceMode: global.maintenanceMode ?? false,
    maintenanceMessage: global.maintenanceMessage,
    minAppVersion: global.minAppVersion ?? '0.0.0',
    // identidad
    profileType,
    delegationId: resolvedDelegationId,
    delegationLabel: delegation?.label ?? '',
    profileLabel: profile.label,
    // merged
    tabs: merged.tabs,
    homeButtons: merged.homeButtons,
    masItems: merged.masItems,
    defaultCalendars: merged.defaultCalendars,
    albumTags: merged.albumTags,
    notificationTopics: merged.notificationTopics,
  };
}

/**
 * Compara dos versiones semver de forma tolerante (acepta `1.0.1`, `1.0.1-beta`, etc.)
 * Devuelve true si `appVersion` >= `minVersion`.
 */
export function isAppVersionSupported(
  appVersion: string,
  minVersion: string,
): boolean {
  // Sin minVersion (o "0.0.0") = sin bloqueo. Caso defensivo extra contra
  //   strings vacíos / undefined coercidos.
  if (!minVersion || minVersion === '0.0.0') return true;

  const parse = (v: string): [number, number, number] => {
    const safe = typeof v === 'string' && v.length > 0 ? v : '0.0.0';
    const clean = safe.split('-')[0].split('+')[0];
    const parts = clean.split('.').map((n) => {
      const parsed = parseInt(n, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    });
    while (parts.length < 3) parts.push(0);
    return [parts[0], parts[1], parts[2]];
  };
  const [a1, a2, a3] = parse(appVersion);
  const [m1, m2, m3] = parse(minVersion);
  if (a1 !== m1) return a1 > m1;
  if (a2 !== m2) return a2 > m2;
  return a3 >= m3;
}

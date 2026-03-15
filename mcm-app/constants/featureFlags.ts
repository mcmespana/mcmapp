export interface TabsFlags {
  index: boolean;
  mas: boolean;
  cancionero: boolean;
  calendario: boolean;
  fotos: boolean;
  comunica: boolean;
}

export interface FeatureFlags {
  tabs: TabsFlags;
  defaultTab: keyof TabsFlags;
  showNotificationsIcon: boolean;
  showUserProfilePrompt: boolean;
  showMonitores: boolean;
  showChangeNameButton: boolean;
  /** Muestra el acceso a Comunica (comunica.movimientoconsolacion.com) en Home y en Más */
  showComunica: boolean;
  /** Muestra el acceso a Comunica Gestión (sinergiacrm.org) en Más */
  showComunicaGestion: boolean;
}

// Default feature flags (hardcoded fallback)
// These will be overridden by remote config if available
const featureFlags: FeatureFlags = {
  tabs: {
    index: true,
    mas: true,
    cancionero: true,
    calendario: true,
    fotos: true,
    comunica: false,
  },
  defaultTab: 'index',
  showNotificationsIcon: true,
  showUserProfilePrompt: false,
  showMonitores: false,
  showChangeNameButton: false,
  showComunica: true,
  showComunicaGestion: true,
};

export default featureFlags;
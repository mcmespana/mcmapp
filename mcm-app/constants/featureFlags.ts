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
}

// Default feature flags (hardcoded fallback)
// These will be overridden by remote config if available
const featureFlags: FeatureFlags = {
  tabs: {
    index: true,
    mas: true,
    cancionero: false, // Disabled by default, enable via OTA update
    calendario: true,
    fotos: true,
    comunica: false,
  },
  defaultTab: 'iqndex',
  showNotificationsIcon: true,
  showUserProfilePrompt: false,
};

export default featureFlags;
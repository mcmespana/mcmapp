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
  showNotificationsIcon: false,
  showUserProfilePrompt: false,
};

export default featureFlags;

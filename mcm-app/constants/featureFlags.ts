export interface TabsFlags {
  index: boolean;
  jubileo: boolean;
  cancionero: boolean;
  calendario: boolean;
  fotos: boolean;
  comunica: boolean;
  cuentas: boolean;
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
    jubileo: true,
    cancionero: true,
    calendario: true,
    fotos: true,
    comunica: false,
    cuentas: true,
  },
  defaultTab: 'index',
  showNotificationsIcon: false,
  showUserProfilePrompt: false,
};

export default featureFlags;

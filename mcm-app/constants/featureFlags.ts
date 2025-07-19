export interface TabsFlags {
  index: boolean;
  jubileo: boolean;
  cancionero: boolean;
  calendario: boolean;
  fotos: boolean;
  comunica: boolean;
}

export interface FeatureFlags {
  tabs: TabsFlags;
  defaultTab: keyof TabsFlags;
  showNotificationsIcon: boolean;
}

const featureFlags: FeatureFlags = {
  tabs: {
    index: true,
    jubileo: true,
    cancionero: true,
    calendario: true,
    fotos: true,
    comunica: false,
  },
  defaultTab: 'index',
  showNotificationsIcon: true,
};

export default featureFlags;

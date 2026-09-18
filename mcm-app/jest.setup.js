/**
 * Mocks de módulos NATIVOS, para toda la suite.
 *
 * Un módulo de Expo con parte nativa llama a `requireNativeModule()` al
 * cargarse, y bajo Jest no hay TurboModule que devolver: la suite entera muere
 * en el `import`, antes de ejecutar una línea de test. Da igual que el test no
 * use esa función — basta con que algo del árbol la importe de rebote.
 *
 * Hasta ahora eso no molestaba porque los tests eran de lógica pura. Al montar
 * pantallas de verdad (`__tests__/screenSmoke.test.tsx`) el árbol arrastra la
 * torre de providers completa, y con ella media docena de módulos nativos.
 * Están aquí y no en el test para que el siguiente test de render no tenga que
 * volver a descubrirlos uno a uno — que es exactamente el muro que hace que
 * "añadir un test de pantalla" parezca caro y no se haga.
 *
 * Cada mock imita lo que la app espera de vuelta, no más. Un test que necesite
 * otro comportamiento lo sobrescribe con `jest.mock(...)` en su propio
 * fichero, que gana sobre esto.
 */

// El icono alternativo de Carismochito (`utils/appIcon.ts`).
jest.mock('expo-alternate-app-icons', () => ({
  getAppIconName: jest.fn(() => 'DEFAULT'),
  setAlternateAppIcon: jest.fn(() => Promise.resolve()),
  supportsAlternateIcons: false,
}));

// Hápticas: se llaman desde cualquier pulsación.
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// Notificaciones push: el provider pide permisos y se suscribe al montar.
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'undetermined' }),
  ),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'denied' })),
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'mock-token' })),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  getNotificationChannelsAsync: jest.fn(() => Promise.resolve([])),
  setBadgeCountAsync: jest.fn(() => Promise.resolve()),
  getLastNotificationResponseAsync: jest.fn(() => Promise.resolve(null)),
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1 },
  AndroidNotificationVisibility: { PUBLIC: 1, PRIVATE: 0, SECRET: -1 },
}));

// Sesión del navegador (login con Google en web) y Apple Authentication.
jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(() => Promise.resolve({ type: 'cancel' })),
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(false)),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

// Detector de sacudidas de Carismochito (acelerómetro).
jest.mock('expo-sensors', () => ({
  Accelerometer: {
    isAvailableAsync: jest.fn(() => Promise.resolve(false)),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    setUpdateInterval: jest.fn(),
  },
}));

// El módulo local del menú "Subrayar" (`modules/highlight-menu`), que es
// nativo puro y no tiene shim.
jest.mock('@/modules/highlight-menu', () => ({
  __esModule: true,
  isHighlightMenuAvailable: false,
  setHighlightMenuEnabled: jest.fn(),
  addHighlightRequestListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// Analítica (Aptabase) y Sentry: se importan desde utils y arrancan al cargar.
jest.mock('@aptabase/react-native', () => ({
  init: jest.fn(),
  trackEvent: jest.fn(),
}));

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: (c) => c,
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
  reactNavigationIntegration: jest.fn(() => ({})),
  mobileReplayIntegration: jest.fn(() => ({})),
}));

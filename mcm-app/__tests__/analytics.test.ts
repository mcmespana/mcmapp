/**
 * Tests de `utils/analytics.ts` (envoltorio de Aptabase).
 *
 * La invariante que sostiene el diseño: **sin `EXPO_PUBLIC_APTABASE_KEY`,
 * la analítica no manda NADA** — mismo patrón que `utils/sentry.ts`. El
 * módulo guarda estado propio (`started`, `baseProps`), así que cada caso
 * necesita una copia limpia con `jest.resetModules()`.
 */
jest.mock('@aptabase/react-native', () => ({
  init: jest.fn(),
  trackEvent: jest.fn(),
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '2.1.0' } },
}));

function cargar(env: { key?: string; host?: string }) {
  jest.resetModules();
  if (env.key === undefined) delete process.env.EXPO_PUBLIC_APTABASE_KEY;
  else process.env.EXPO_PUBLIC_APTABASE_KEY = env.key;
  if (env.host === undefined) delete process.env.EXPO_PUBLIC_APTABASE_HOST;
  else process.env.EXPO_PUBLIC_APTABASE_HOST = env.host;
  /* eslint-disable @typescript-eslint/no-require-imports */
  const Aptabase = require('@aptabase/react-native');
  const logger = require('@/utils/logger');
  const analytics = require('@/utils/analytics');
  /* eslint-enable @typescript-eslint/no-require-imports */
  return { Aptabase, analytics, logger: logger.logger };
}

const ENV_ORIGINAL = {
  key: process.env.EXPO_PUBLIC_APTABASE_KEY,
  host: process.env.EXPO_PUBLIC_APTABASE_HOST,
};

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  process.env.EXPO_PUBLIC_APTABASE_KEY = ENV_ORIGINAL.key;
  process.env.EXPO_PUBLIC_APTABASE_HOST = ENV_ORIGINAL.host;
});

describe('sin EXPO_PUBLIC_APTABASE_KEY', () => {
  it('isAnalyticsEnabled es false y nada se inicializa ni se manda', () => {
    const { Aptabase, analytics } = cargar({ key: undefined });
    expect(analytics.isAnalyticsEnabled).toBe(false);
    analytics.initAnalytics();
    analytics.trackEvent('app_abierta');
    expect(Aptabase.init).not.toHaveBeenCalled();
    expect(Aptabase.trackEvent).not.toHaveBeenCalled();
  });
});

describe('con clave configurada', () => {
  it('isAnalyticsEnabled es true', () => {
    const { analytics } = cargar({ key: 'A-EU-0000000000' });
    expect(analytics.isAnalyticsEnabled).toBe(true);
  });

  it('initAnalytics arranca Aptabase con la versión del manifiesto', () => {
    const { Aptabase, analytics } = cargar({ key: 'A-EU-0000000000' });
    analytics.initAnalytics();
    expect(Aptabase.init).toHaveBeenCalledWith(
      'A-EU-0000000000',
      expect.objectContaining({ appVersion: '2.1.0', enableWeb: true }),
    );
  });

  it('es idempotente: llamarlo dos veces solo inicializa una', () => {
    const { Aptabase, analytics } = cargar({ key: 'A-EU-0000000000' });
    analytics.initAnalytics();
    analytics.initAnalytics();
    expect(Aptabase.init).toHaveBeenCalledTimes(1);
  });

  it('con host autoalojado, lo incluye en las opciones', () => {
    const { Aptabase, analytics } = cargar({
      key: 'A-SH-0000000000',
      host: 'https://analytics.mcm.example',
    });
    analytics.initAnalytics();
    expect(Aptabase.init).toHaveBeenCalledWith(
      'A-SH-0000000000',
      expect.objectContaining({ host: 'https://analytics.mcm.example' }),
    );
  });

  it('sin host, no lo incluye en las opciones', () => {
    const { Aptabase, analytics } = cargar({ key: 'A-EU-0000000000' });
    analytics.initAnalytics();
    const opts = (Aptabase.init as jest.Mock).mock.calls[0][1];
    expect(opts).not.toHaveProperty('host');
  });

  it('si Aptabase.init lanza, se puede reintentar (started vuelve a false)', () => {
    const { Aptabase, analytics } = cargar({ key: 'A-EU-0000000000' });
    (Aptabase.init as jest.Mock).mockImplementationOnce(() => {
      throw new Error('fallo nativo');
    });
    expect(() => analytics.initAnalytics()).not.toThrow();
    analytics.initAnalytics();
    expect(Aptabase.init).toHaveBeenCalledTimes(2);
  });

  it('trackEvent no manda nada si initAnalytics no se ha llamado', () => {
    const { Aptabase, analytics } = cargar({ key: 'A-EU-0000000000' });
    analytics.trackEvent('app_abierta');
    expect(Aptabase.trackEvent).not.toHaveBeenCalled();
  });

  it('trackEvent manda el nombre con las baseProps por defecto', () => {
    const { Aptabase, analytics } = cargar({ key: 'A-EU-0000000000' });
    analytics.initAnalytics();
    analytics.trackEvent('app_abierta');
    expect(Aptabase.trackEvent).toHaveBeenCalledWith('app_abierta', {
      perfil: 'sin_perfil',
      delegacion: 'sin_delegacion',
    });
  });

  it('setAnalyticsProfile actualiza lo que acompaña a los eventos siguientes', () => {
    const { Aptabase, analytics } = cargar({ key: 'A-EU-0000000000' });
    analytics.initAnalytics();
    analytics.setAnalyticsProfile({ perfil: 'monitor', delegacion: 'madrid' });
    analytics.trackEvent('app_abierta');
    expect(Aptabase.trackEvent).toHaveBeenCalledWith('app_abierta', {
      perfil: 'monitor',
      delegacion: 'madrid',
    });
  });

  it('las propiedades propias del evento se mezclan sobre las baseProps', () => {
    const { Aptabase, analytics } = cargar({ key: 'A-EU-0000000000' });
    analytics.initAnalytics();
    analytics.trackEvent('pantalla_vista', { ruta: 'cancionero' });
    expect(Aptabase.trackEvent).toHaveBeenCalledWith('pantalla_vista', {
      perfil: 'sin_perfil',
      delegacion: 'sin_delegacion',
      ruta: 'cancionero',
    });
  });

  it('si Aptabase.trackEvent lanza, no propaga el error', () => {
    const { Aptabase, analytics } = cargar({ key: 'A-EU-0000000000' });
    analytics.initAnalytics();
    (Aptabase.trackEvent as jest.Mock).mockImplementationOnce(() => {
      throw new Error('red caída');
    });
    expect(() => analytics.trackEvent('app_abierta')).not.toThrow();
  });
});

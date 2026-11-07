/**
 * Tests de `utils/sentry.ts`.
 *
 * La invariante que sostiene toda la decisión de diseño: **sin
 * `EXPO_PUBLIC_SENTRY_DSN`, la app se comporta exactamente igual que si Sentry
 * no existiera** — no se llama a `init`, no se engancha el logger y `wrapRoot`
 * devuelve el componente tal cual. El SDK nativo viaja en el binario y se
 * enciende luego por OTA; si esto se rompiera, encender Sentry dejaría de ser
 * una decisión y pasaría a ser un cambio de comportamiento.
 *
 * El módulo arranca al importarse (`initSentry()` al final del fichero), así
 * que cada caso necesita una copia limpia con `jest.resetModules()`.
 */
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: jest.fn((c) => c),
  captureMessage: jest.fn(),
  captureException: jest.fn(),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { updates: { channel: 'preview' } } },
}));

const DSN = 'https://clave@o1.ingest.sentry.io/1';

/** Carga el módulo con el entorno indicado y devuelve sus piezas. */
function cargar(env: Record<string, string | undefined>) {
  jest.resetModules();
  // Ojo: asignar `undefined` a process.env guarda la CADENA "undefined".
  if (env.dsn === undefined) delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  else process.env.EXPO_PUBLIC_SENTRY_DSN = env.dsn;
  if (env.debug === undefined) delete process.env.EXPO_PUBLIC_SENTRY_DEBUG;
  else process.env.EXPO_PUBLIC_SENTRY_DEBUG = env.debug;
  /* eslint-disable @typescript-eslint/no-require-imports */
  const Sentry = require('@sentry/react-native');
  const logger = require('@/utils/logger');
  const sentry = require('@/utils/sentry');
  /* eslint-enable @typescript-eslint/no-require-imports */
  return { Sentry, sentry, logger: logger.logger };
}

const ENV_ORIGINAL = {
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  debug: process.env.EXPO_PUBLIC_SENTRY_DEBUG,
};

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  process.env.EXPO_PUBLIC_SENTRY_DSN = ENV_ORIGINAL.dsn;
  process.env.EXPO_PUBLIC_SENTRY_DEBUG = ENV_ORIGINAL.debug;
});

describe('sin DSN configurado', () => {
  it('no arranca Sentry ni al importar ni al llamar a initSentry', () => {
    const { Sentry, sentry } = cargar({ dsn: undefined, debug: undefined });
    expect(sentry.isSentryEnabled).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
    sentry.initSentry();
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('wrapRoot devuelve el componente tal cual', () => {
    const { Sentry, sentry } = cargar({ dsn: '', debug: undefined });
    const Root = () => null;
    expect(sentry.wrapRoot(Root)).toBe(Root);
    expect(Sentry.wrap).not.toHaveBeenCalled();
  });

  it('no engancha el logger: un logger.error no reporta nada', () => {
    const { Sentry, logger } = cargar({ dsn: '', debug: undefined });
    logger.error('algo ha ido mal');
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});

describe('con DSN configurado', () => {
  it('arranca al importar el módulo, con el entorno del canal de EAS', () => {
    const { Sentry, sentry } = cargar({ dsn: DSN, debug: undefined });
    expect(sentry.isSentryEnabled).toBe(true);
    expect(Sentry.init).toHaveBeenCalledTimes(1);
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: DSN,
        environment: 'preview',
        tracesSampleRate: 0,
        sendDefaultPii: false,
      }),
    );
  });

  it('initSentry es idempotente', () => {
    const { Sentry, sentry } = cargar({ dsn: DSN, debug: undefined });
    sentry.initSentry();
    sentry.initSentry();
    expect(Sentry.init).toHaveBeenCalledTimes(1);
  });

  it('wrapRoot envuelve el componente', () => {
    const { Sentry, sentry } = cargar({ dsn: DSN, debug: undefined });
    const Root = () => null;
    sentry.wrapRoot(Root);
    expect(Sentry.wrap).toHaveBeenCalledWith(Root);
  });

  it('en modo normal no manda ping de verificación', () => {
    const { Sentry } = cargar({ dsn: DSN, debug: undefined });
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('con EXPO_PUBLIC_SENTRY_DEBUG=1 manda el ping y reporta también en dev', () => {
    const { Sentry } = cargar({ dsn: DSN, debug: '1' });
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('ping de verificación'),
      'info',
    );
  });
});

describe('enganche del logger', () => {
  it('logger.warn se reporta como warning', () => {
    const { Sentry, logger } = cargar({ dsn: DSN, debug: undefined });
    logger.warn('cuidado', { a: 1 });
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'cuidado {"a":1}',
      'warning',
    );
  });

  it('logger.error con Error usa captureException y adjunta el detalle', () => {
    const { Sentry, logger } = cargar({ dsn: DSN, debug: undefined });
    const boom = new Error('boom');
    logger.error('fallo al guardar', boom);
    expect(Sentry.captureException).toHaveBeenCalledWith(boom, {
      extra: { detalle: 'fallo al guardar Error: boom' },
    });
  });

  it('logger.error sin Error usa captureMessage', () => {
    const { Sentry, logger } = cargar({ dsn: DSN, debug: undefined });
    logger.error('fallo suelto');
    expect(Sentry.captureMessage).toHaveBeenCalledWith('fallo suelto', 'error');
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('un argumento no serializable no rompe el formateo', () => {
    const { Sentry, logger } = cargar({ dsn: DSN, debug: undefined });
    const ciclico: Record<string, unknown> = {};
    ciclico.self = ciclico;
    expect(() => logger.error('ciclo', ciclico)).not.toThrow();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('ciclo'),
      'error',
    );
  });
});

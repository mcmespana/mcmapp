/**
 * Guardarraíl del plan 10 §7 (revisión A10): el pase al legado y los tokens
 * de la sesión no aparecen en ningún log (ni en la consola ni en lo que va a
 * Sentry), aunque el servidor conteste mal en cada paso.
 */
import { createHttpClient } from '@/services/comunica/client';
import { prepareLegacy } from '@/services/comunica/legacy';
import {
  __resetSessionForTests,
  configureSession,
  currentAccessToken,
  getAccessToken,
  memorySecretStore,
  signIn,
  signOut,
  withSession,
} from '@/services/comunica/session';
import { memoryBackend, setStorageBackend } from '@/services/comunica/storage';
import { setReporter } from '@/utils/logger';

jest.mock('expo-image', () => ({
  Image: {
    clearDiskCache: jest.fn().mockResolvedValue(true),
    clearMemoryCache: jest.fn().mockResolvedValue(true),
    prefetch: jest.fn().mockResolvedValue(true),
  },
}));

// El selector del área devuelve el cliente que se le diga.
const mockApi: { current: unknown } = { current: null };
jest.mock('@/services/comunica', () => ({
  getComunicaApi: () => mockApi.current,
}));

const SECRETS = [
  'ACCESS-SECRET',
  'REFRESH-SECRET',
  'ROTATED-SECRET',
  'MAGIC-SECRET',
  'PASS-SECRET',
];

const respond = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

describe('nada secreto en los logs', () => {
  const logged: unknown[][] = [];
  beforeEach(() => {
    logged.length = 0;
    __resetSessionForTests();
    setStorageBackend(memoryBackend());
    setReporter({
      warn: (...a) => logged.push(a),
      error: (...a) => logged.push(a),
    });
    for (const m of ['log', 'info', 'debug', 'warn', 'error'] as const) {
      jest
        .spyOn(console, m)
        .mockImplementation((...a: unknown[]) => void logged.push(a));
    }
  });
  afterEach(() => {
    setReporter(null);
    jest.restoreAllMocks();
  });

  it('con respuestas rotas, 403, 500 y sin red', async () => {
    let call = 0;
    const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
      call += 1;
      const body = String(init?.body ?? '');
      if (url.endsWith('/v1/auth/refresh')) {
        // Primero un refresco con forma rota (con el token dentro), luego 500.
        return call % 2
          ? respond(200, { accessToken: 'ROTATED-SECRET', refreshToken: 7 })
          : respond(500, { echo: body });
      }
      if (url.endsWith('/v1/auth/exchange')) {
        return respond(200, { token: 'MAGIC-SECRET', me: null });
      }
      if (url.endsWith('/v1/web-pass')) {
        // Un pase con la fecha mal: la respuesta es rota y lleva el pase.
        return respond(200, {
          url: 'https://comunica.test/ap/?acceso_magico=PASS-SECRET',
          expiresAt: 'mañana',
        });
      }
      if (url.endsWith('/v1/auth/logout')) throw new Error('sin red');
      return respond(403, { echo: body });
    });
    const raw = createHttpClient({
      baseUrl: 'https://api.test',
      // Como `services/comunica/index.ts`: el token tal cual (el refresco lo
      // hace `withSession`).
      getToken: currentAccessToken,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    configureSession({
      refresh: (r) => raw.refresh(r),
      logout: (r) => raw.logout(r),
      secrets: memorySecretStore(),
    });
    const api = withSession(raw);
    mockApi.current = api;

    await signIn(
      {
        accessToken: 'ACCESS-SECRET',
        refreshToken: 'REFRESH-SECRET',
        expiresIn: 1,
      },
      {
        personId: 'p1',
        name: 'Lucía',
        delegation: { id: 'd1', name: 'Villaclara' },
        roles: ['monitor'],
        scope: 'delegation',
        canSeeHealth: true,
      } as never,
    );
    await api.getMe().catch(() => {});
    await api.getPeople().catch(() => {});
    await api.exchange({ magic: 'MAGIC-SECRET' }).catch(() => {});
    expect(await prepareLegacy({ internalpage: 'inicio' }, 'Comunica')).toBe(
      false,
    );
    await getAccessToken(true);
    await signOut();

    expect(fetchImpl).toHaveBeenCalled();
    // Se ha llegado a registrar algo (si no, el test no prueba nada).
    expect(logged.length).toBeGreaterThan(0);
    const text = JSON.stringify(logged, (_k, v) =>
      v instanceof Error ? { message: v.message, stack: v.stack } : v,
    );
    for (const s of SECRETS)
      expect({ secret: s, leaked: text.includes(s) }).toEqual({
        secret: s,
        leaked: false,
      });
  });
});

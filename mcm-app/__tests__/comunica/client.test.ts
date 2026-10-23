import { createHttpClient, ComunicaApiError } from '@/services/comunica/client';
import { setReporter } from '@/utils/logger';

const me = {
  generatedAt: '2026-10-24T10:00:00+02:00',
  me: {
    personId: 'p1',
    name: 'Lucía',
    delegation: { id: 'd1', name: 'Villaclara' },
    roles: ['monitor'],
    scope: 'delegation',
    canSeeHealth: true,
  },
};

const respond = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

const client = (fetchImpl: jest.Mock, token: string | null = 'tok') =>
  createHttpClient({
    baseUrl: 'https://api.test/',
    getToken: () => token,
    fetchImpl,
  });

describe('services/comunica/client', () => {
  const errors: unknown[][] = [];
  beforeAll(() =>
    setReporter({ error: (...a) => errors.push(a), warn: () => {} }),
  );
  afterAll(() => setReporter(null));
  beforeEach(() => {
    errors.length = 0;
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('pide con la sesión y valida lo que llega', async () => {
    const f = jest.fn().mockResolvedValue(respond(200, me));
    await expect(client(f).getMe()).resolves.toEqual(me);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://api.test/v1/me');
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('una respuesta con forma rota es un error tipado y avisa a Sentry', async () => {
    const f = jest.fn().mockResolvedValue(respond(200, { generatedAt: 'x' }));
    await expect(client(f).getMe()).rejects.toMatchObject({
      code: 'bad_response',
    });
    expect(errors).toHaveLength(1);
  });

  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
  ])('%i → %s, sin reintentar', async (status, code) => {
    const f = jest
      .fn()
      .mockResolvedValue(respond(status, { error: { code, message: 'x' } }));
    await expect(client(f).getMe()).rejects.toMatchObject({ code, status });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('503 se reintenta una vez en lecturas', async () => {
    const f = jest
      .fn()
      .mockResolvedValueOnce(
        respond(503, { error: { code: 'crm_unavailable', message: 'caído' } }),
      )
      .mockResolvedValueOnce(respond(200, me));
    await expect(client(f).getMe()).resolves.toEqual(me);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('las escrituras no se reintentan (lo hace la cola)', async () => {
    const f = jest.fn().mockResolvedValue(respond(503, {}));
    const p = client(f).saveRoll('s', 'g', {
      clientId: '3b241101-e2bb-4255-8caf-4136c566a962',
      action: 'skip',
      marks: {},
      notes: {},
    });
    await expect(p).rejects.toMatchObject({
      code: 'crm_unavailable',
      retryable: true,
    });
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][1].method).toBe('PUT');
  });

  it('sin red es `network`', async () => {
    const f = jest
      .fn()
      .mockRejectedValue(new TypeError('Network request failed'));
    const err = await client(f)
      .getToday()
      .catch((e) => e);
    expect(err).toBeInstanceOf(ComunicaApiError);
    expect(err.code).toBe('network');
  });

  it('?fresh=1 viaja y los ids se codifican', async () => {
    const f = jest.fn().mockResolvedValue(respond(500, {}));
    await client(f, null)
      .getRoll('a/b', 'c d', { fresh: true })
      .catch(() => {});
    expect(f.mock.calls[0][0]).toBe(
      'https://api.test/v1/sessions/a%2Fb/groups/c%20d/roll?fresh=1',
    );
    expect(f.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
});

import {
  createHttpClient,
  ComunicaApiError,
  READ_TIMEOUT_MS,
  WRITE_TIMEOUT_MS,
} from '@/services/comunica/client';
import { setWorkingDelegation } from '@/services/comunica/delegation';
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

  it('503: NO se repite al momento (lo reintenta la caché con espera); sigue siendo reintentable', async () => {
    // Repetirlo aquí duplicaba las peticiones de cada pantalla con el servidor
    // caído (6/11/2026): 2 aquí × 3 de la caché = 6 por consulta.
    const f = jest
      .fn()
      .mockResolvedValueOnce(
        respond(503, { error: { code: 'crm_unavailable', message: 'caído' } }),
      )
      .mockResolvedValueOnce(respond(200, me));
    await expect(client(f).getMe()).rejects.toMatchObject({
      code: 'crm_unavailable',
      retryable: true,
    });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('un corte de red en una lectura sí se repite al momento, una vez', async () => {
    const f = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce(respond(200, me));
    await expect(client(f).getMe()).resolves.toEqual(me);
    expect(f).toHaveBeenCalledTimes(2);
  });

  describe('tiempo límite', () => {
    /** Un `fetch` que no contesta nunca, salvo que lo corten. */
    const hanging = () =>
      jest.fn(
        (_url: string, init: { signal?: AbortSignal }) =>
          new Promise<Response>((_res, rej) => {
            init.signal?.addEventListener('abort', () =>
              rej(Object.assign(new Error('Aborted'), { name: 'AbortError' })),
            );
          }),
      );
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('una lectura colgada se corta a los READ_TIMEOUT_MS: `network`/`timeout`, reintentable, sin repetir al momento', async () => {
      const f = hanging();
      const p = client(f as unknown as jest.Mock)
        .getMe()
        .catch((e) => e);
      await jest.advanceTimersByTimeAsync(READ_TIMEOUT_MS - 1);
      expect(f).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(2);
      const err = await p;
      expect(err).toBeInstanceOf(ComunicaApiError);
      expect(err).toMatchObject({
        code: 'network',
        reason: 'timeout',
        retryable: true,
      });
      expect(f).toHaveBeenCalledTimes(1);
    });

    it('una escritura colgada se corta a los WRITE_TIMEOUT_MS (la cola la repetirá con el mismo clientId)', async () => {
      const f = hanging();
      const p = client(f as unknown as jest.Mock)
        .setScarf('k1', {
          clientId: '3b241101-e2bb-4255-8caf-4136c566a962',
          scarf: 'blue',
        })
        .catch((e) => e);
      await jest.advanceTimersByTimeAsync(READ_TIMEOUT_MS + 1);
      await jest.advanceTimersByTimeAsync(WRITE_TIMEOUT_MS - READ_TIMEOUT_MS);
      expect(await p).toMatchObject({ code: 'network', reason: 'timeout' });
    });

    it('un cuerpo que no acaba también se corta', async () => {
      const f = jest.fn((_url: string, init: { signal?: AbortSignal }) =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            new Promise((_res, rej) =>
              init.signal?.addEventListener('abort', () =>
                rej(new Error('Aborted')),
              ),
            ),
        } as unknown as Response),
      );
      const p = client(f as unknown as jest.Mock)
        .getMe()
        .catch((e) => e);
      await jest.advanceTimersByTimeAsync(READ_TIMEOUT_MS + 1);
      expect(await p).toMatchObject({ code: 'network', reason: 'timeout' });
    });

    it('una respuesta a tiempo no deja el reloj corriendo', async () => {
      const f = jest.fn().mockResolvedValue(respond(200, me));
      await expect(client(f).getMe()).resolves.toEqual(me);
      expect(jest.getTimerCount()).toBe(0);
    });
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

  it('las escrituras avisan de que entienden la cola del servidor; las lecturas, no', async () => {
    const f = jest.fn().mockResolvedValue(respond(200, me));
    await client(f).getMe();
    expect(f.mock.calls[0][1].headers['X-Comunica-Queue']).toBeUndefined();
    f.mockResolvedValue(respond(503, {}));
    await client(f)
      .setScarf('k1', {
        clientId: '3b241101-e2bb-4255-8caf-4136c566a962',
        scarf: 'blue',
      })
      .catch(() => {});
    expect(f.mock.calls[1][1].headers['X-Comunica-Queue']).toBe('1');
  });

  it('202 «queued»: no es un fallo ni una respuesta rota, es `queued` (la tiene el servidor)', async () => {
    const clientId = '3b241101-e2bb-4255-8caf-4136c566a962';
    const f = jest
      .fn()
      .mockResolvedValue(respond(202, { clientId, status: 'queued' }));
    const p = client(f).saveRoll('s', 'g', {
      clientId,
      action: 'skip',
      marks: {},
      notes: {},
    });
    await expect(p).rejects.toMatchObject({
      code: 'queued',
      status: 202,
      retryable: false,
    });
    expect(errors).toHaveLength(0);
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

  it('400 sin cuerpo es `validation` (no se reintenta); 500 sigue siendo reintentable (por la caché, no al momento)', async () => {
    const f400 = jest.fn().mockResolvedValue(respond(400, {}));
    await expect(client(f400).getMe()).rejects.toMatchObject({
      code: 'validation',
      retryable: false,
    });
    expect(f400).toHaveBeenCalledTimes(1);
    const f500 = jest
      .fn()
      .mockResolvedValueOnce(respond(500, {}))
      .mockResolvedValueOnce(respond(200, me));
    await expect(client(f500).getMe()).rejects.toMatchObject({
      code: 'crm_unavailable',
      retryable: true,
    });
    expect(f500).toHaveBeenCalledTimes(1);
  });

  it('la foto lleva el token SOLO si es de nuestro servidor', () => {
    const c = client(jest.fn());
    expect(c.photoSource('https://api.test/v1/photos/p1?v=2')).toEqual({
      uri: 'https://api.test/v1/photos/p1?v=2',
      headers: { Authorization: 'Bearer tok' },
      cacheKey: 'https://api.test/v1/photos/p1?v=2',
    });
    for (const url of [
      'https://otro.example/p1.jpg',
      'https://api.test.evil.example/p1.jpg',
      'http://api.test/v1/photos/p1',
    ]) {
      expect(c.photoSource(url).headers).toBeUndefined();
    }
  });

  it('la foto de alguien del equipo va con la delegación de trabajo (como su ficha); la de un perfil propio, no', () => {
    const c = client(jest.fn());
    setWorkingDelegation('d-bur');
    try {
      expect(
        c.photoSource('https://api.test/v1/people/p1/photo?v=abc123').headers,
      ).toEqual({
        Authorization: 'Bearer tok',
        'X-Comunica-Delegation': 'd-bur',
      });
      expect(
        c.photoSource('https://api.test/v1/profiles/p1/photo?v=abc123').headers,
      ).toEqual({ Authorization: 'Bearer tok' });
      // A otro dominio, nada: ni sesión ni delegación.
      expect(
        c.photoSource('https://otro.example/v1/people/p1/photo').headers,
      ).toBeUndefined();
    } finally {
      setWorkingDelegation(null);
    }
  });
});

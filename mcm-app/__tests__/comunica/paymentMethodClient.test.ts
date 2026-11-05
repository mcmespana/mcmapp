/**
 * «Forma de pago» (05/11/2026): el cliente HTTP contra lo que contesta el middleware (`comunicaMiddleware:src/contract-profile-payment-method.ts`).
 *
 *   · `GET` y `PUT /v1/profiles/:pid/payment-method` con la sesión puesta y el `pid` escapado; el cuerpo del `PUT`, tal cual y sin cabecera de delegación.
 *   · Lo que llega se valida con esquemas ESTRICTOS: una lectura con un IBAN entero (o sin hora) es `bad_response`, nunca algo que se pinta.
 *   · Los errores del servidor: 422 con su `reason`, 403 y los 503 (`crm_not_confirmed`…), que se pueden reintentar con el MISMO `clientId`.
 *   · Ni el IBAN que se escribe ni el que llega salen en un registro.
 */
import { createHttpClient } from '@/services/comunica/client';
import { setReporter } from '@/utils/logger';

const IBAN_A = 'ES9300494898982516218644';
const ID = '3b241101-e2bb-4255-8caf-4136c566a962';

const info = {
  kind: 'domiciliacion',
  options: [
    { kind: 'domiciliacion', label: 'Domiciliación bancaria' },
    { kind: 'transferencia', label: 'Transferencia' },
    { kind: 'bizum', label: 'Bizum' },
  ],
  ibanMasked: 'ES93 •••• 8644',
  holder: 'Marta Pérez',
  forName: null,
};
const read = { ...info, generatedAt: '2026-11-05T10:00:00+01:00' };
const saved = {
  ok: true,
  partial: false,
  updated: { commitments: 1, payments: 2, inProgress: 0 },
  flagged: 0,
  current: info,
};

const respond = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;
const error = (code: string, reason?: string) => ({
  error: { code, message: 'x', ...(reason ? { reason } : {}) },
});
const client = (fetchImpl: jest.Mock) =>
  createHttpClient({
    baseUrl: 'https://api.test/',
    getToken: () => 'tok',
    fetchImpl,
  });

describe('forma de pago: el cliente HTTP', () => {
  const logged: unknown[][] = [];
  beforeAll(() =>
    setReporter({
      error: (...a) => logged.push(a),
      warn: (...a) => logged.push(a),
    }),
  );
  afterAll(() => setReporter(null));
  beforeEach(() => {
    logged.length = 0;
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('GET: a la ruta del perfil, con la sesión, sin cuerpo y sin cabecera de delegación', async () => {
    const f = jest.fn().mockResolvedValue(respond(200, read));
    await expect(client(f).getPaymentMethod('f/hijo 1')).resolves.toEqual(read);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe(
      'https://api.test/v1/profiles/f%2Fhijo%201/payment-method',
    );
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(init.headers['X-Comunica-Delegation']).toBeUndefined();
    expect(init.body).toBeUndefined();
  });

  it('PUT: el cuerpo viaja tal cual y la respuesta se valida', async () => {
    const f = jest.fn().mockResolvedValue(respond(200, saved));
    const body = {
      clientId: ID,
      kind: 'domiciliacion' as const,
      iban: IBAN_A,
      holder: 'Marta Pérez',
    };
    await expect(client(f).savePaymentMethod('p1', body)).resolves.toEqual(
      saved,
    );
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://api.test/v1/profiles/p1/payment-method');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual(body);
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['X-Comunica-Delegation']).toBeUndefined();
  });

  it('una lectura con un IBAN entero, un campo de más o sin hora es `bad_response` (y no se escribe el IBAN en el registro)', async () => {
    for (const bad of [
      { ...read, iban: IBAN_A },
      { ...read, kind: 'cargo_cuenta' },
      info,
    ]) {
      const f = jest.fn().mockResolvedValue(respond(200, bad));
      await expect(client(f).getPaymentMethod('p1')).rejects.toMatchObject({
        code: 'bad_response',
      });
    }
    expect(JSON.stringify(logged)).not.toContain(IBAN_A);
  });

  it('una respuesta de guardar sin `current` o con un recuento negativo es `bad_response`', async () => {
    const body = { clientId: ID, kind: 'bizum' as const };
    for (const bad of [
      { ...saved, current: undefined },
      { ...saved, updated: { commitments: -1, payments: 0, inProgress: 0 } },
    ]) {
      const f = jest.fn().mockResolvedValue(respond(200, bad));
      await expect(
        client(f).savePaymentMethod('p1', body),
      ).rejects.toMatchObject({ code: 'bad_response' });
    }
  });

  it.each(['invalid_kind', 'invalid_iban', 'invalid_holder', 'bad_body'])(
    '422 `validation` con `reason` %s: se conserva el motivo y no se reintenta',
    async (reason) => {
      const f = jest
        .fn()
        .mockResolvedValue(respond(422, error('validation', reason)));
      await expect(
        client(f).savePaymentMethod('p1', { clientId: ID, kind: 'bizum' }),
      ).rejects.toMatchObject({ code: 'validation', status: 422, reason });
      expect(f).toHaveBeenCalledTimes(1);
    },
  );

  it('403 `profile_out_of_scope`: `forbidden`', async () => {
    const f = jest
      .fn()
      .mockResolvedValue(
        respond(403, error('forbidden', 'profile_out_of_scope')),
      );
    await expect(client(f).getPaymentMethod('ajeno')).rejects.toMatchObject({
      code: 'forbidden',
      status: 403,
      reason: 'profile_out_of_scope',
    });
  });

  it.each([
    'crm_not_confirmed',
    'crm_timeout',
    'crm_error',
    'db_error',
    'crm_not_configured',
  ])(
    '503 `crm_unavailable` (%s): se puede reintentar con el mismo `clientId` y la escritura no se reintenta aquí',
    async (reason) => {
      const f = jest
        .fn()
        .mockResolvedValue(respond(503, error('crm_unavailable', reason)));
      await expect(
        client(f).savePaymentMethod('p1', { clientId: ID, kind: 'bizum' }),
      ).rejects.toMatchObject({
        code: 'crm_unavailable',
        status: 503,
        reason,
        retryable: true,
      });
      // La cola o la pantalla reintentan, con el MISMO `clientId`; el cliente no.
      expect(f).toHaveBeenCalledTimes(1);
    },
  );

  it('sin red es `network` (reintentable)', async () => {
    const f = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(
      client(f).savePaymentMethod('p1', { clientId: ID, kind: 'bizum' }),
    ).rejects.toMatchObject({ code: 'network', retryable: true });
  });
});

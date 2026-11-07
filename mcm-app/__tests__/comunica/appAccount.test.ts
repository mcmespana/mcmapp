/**
 * Entrar con la cuenta de la app (`identidad-app`): el falso responde como el
 * middleware (`POST /v1/auth/app-account`) y los textos dicen qué ha pasado.
 */
import { createFakeServer } from '@/services/comunica/fake';
import { ComunicaApiError } from '@/services/comunica/client';
import { VerifyResponse } from '@/services/comunica/contract';
import {
  accessErrorDetail,
  accessErrorText,
} from '@/components/comunica/acceso/copy';

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const pase = (email: string) =>
  `${b64({ alg: 'RS256', kid: 'x' })}.${b64({ email })}.firma-de-mentira`;
const server = () => createFakeServer({ latencyMs: 0 });

describe('appAccount (falso)', () => {
  it('un correo de una ficha entra', async () => {
    const r = VerifyResponse.parse(
      await server().appAccount({ idToken: pase('monitor@ejemplo.org') }),
    );
    expect('accessToken' in r).toBe(true);
  });

  it('un correo de varias fichas pregunta y deja elegir solo entre ellas', async () => {
    const s = server();
    const idToken = pase('dos@ejemplo.org');
    const r = await s.appAccount({ idToken });
    if (!('choose' in r)) throw new Error('tenía que preguntar');
    expect(r.choose).toHaveLength(2);
    const ok = await s.appAccount({ idToken, personId: r.choose[1].personId });
    expect('accessToken' in ok && ok.me.personId).toBe(r.choose[1].personId);
  });

  it('un correo que no está: no_match', async () => {
    await expect(
      server().appAccount({ idToken: pase('nadie@ejemplo.org') }),
    ).rejects.toMatchObject({ code: 'validation', reason: 'no_match' });
  });
});

describe('textos del acceso', () => {
  it('servidor sin configurar: lo dice y enseña el código técnico', () => {
    const e = new ComunicaApiError(
      'crm_unavailable',
      'x',
      503,
      'app_not_configured',
    );
    expect(accessErrorText(e)).toMatch(/no responde/);
    expect(accessErrorDetail(e)).toBe(
      'crm_unavailable · app_not_configured · 503',
    );
  });

  it('cuenta de la app sin ficha: manda al código o al DNI', () => {
    const e = new ComunicaApiError('validation', 'x', 422, 'no_match');
    expect(accessErrorText(e)).toMatch(/DNI/);
  });
});

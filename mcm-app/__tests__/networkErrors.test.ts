/**
 * Tests de `utils/networkErrors.ts`: decide qué errores son «no hay red» y,
 * por tanto, no se reportan a Sentry como fallos.
 */
import { isOfflineError } from '@/utils/networkErrors';

describe('isOfflineError', () => {
  it('reconoce el fallo real del token de push sin red (Android)', () => {
    const err = new Error(
      'Error encountered while fetching Expo token: Error: fetch failed: java.net.UnknownHostException: Unable to resolve host "exp.host": No address associated with hostname.',
    );
    expect(isOfflineError(err)).toBe(true);
  });

  it('reconoce los mensajes típicos de RN, iOS y Firebase', () => {
    for (const msg of [
      'Network request failed',
      'The Internet connection appears to be offline.',
      'java.net.SocketTimeoutException: timeout',
      'Failed to connect to exp.host/1.2.3.4:443',
    ]) {
      expect(isOfflineError(new Error(msg))).toBe(true);
    }
    expect(
      isOfflineError(
        Object.assign(new Error('x'), { code: 'auth/network-request-failed' }),
      ),
    ).toBe(true);
  });

  it('mira dentro de la causa', () => {
    const inner = new Error('java.net.UnknownHostException: exp.host');
    const outer = Object.assign(new Error('wrapper'), { cause: inner });
    expect(isOfflineError(outer)).toBe(true);
  });

  it('NO confunde un fallo de verdad con falta de red', () => {
    expect(isOfflineError(new Error('PERMISSION_DENIED'))).toBe(false);
    expect(isOfflineError(new Error('projectId is required'))).toBe(false);
    expect(isOfflineError(null)).toBe(false);
    expect(isOfflineError(undefined)).toBe(false);
    expect(isOfflineError('boom')).toBe(false);
  });
});

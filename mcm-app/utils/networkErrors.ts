/**
 * ¿Este error es solo «el móvil no tiene red»?
 *
 * Sirve para no mandar a Sentry, como si fueran fallos, cosas que pasan cada
 * vez que alguien abre la app en el metro o en modo avión. Ejemplo real
 * (2026-11-08): `getExpoPushTokenAsync` lanzaba `fetch failed:
 * java.net.UnknownHostException: Unable to resolve host "exp.host"`.
 *
 * Mira el mensaje y el `code`, también de la causa (`error.cause`), porque
 * los módulos nativos envuelven el error original. Es puro: se testea en
 * `__tests__/networkErrors.test.ts`.
 */

const OFFLINE_PATTERNS = [
  'unknownhostexception', // Android: no resuelve el DNS
  'unable to resolve host',
  'no address associated with hostname',
  'network request failed', // fetch de React Native
  'networkerror',
  'connectexception', // Android: no conecta
  'sockettimeoutexception',
  'failed to connect to',
  'the internet connection appears to be offline', // iOS (NSURLError -1009)
  'a server with the specified hostname could not be found', // iOS -1003
  'the network connection was lost', // iOS -1005
  'the request timed out', // iOS -1001
  'auth/network-request-failed',
];

const OFFLINE_CODES = new Set([
  'auth/network-request-failed',
  'NSURLErrorDomain-1009',
  'ERR_NETWORK',
]);

function describe(err: unknown): { message: string; code: string } {
  if (!err || typeof err !== 'object') {
    return { message: typeof err === 'string' ? err : '', code: '' };
  }
  const { message, code } = err as { message?: unknown; code?: unknown };
  return {
    message: typeof message === 'string' ? message : '',
    code: typeof code === 'string' ? code : '',
  };
}

export function isOfflineError(err: unknown, depth = 0): boolean {
  if (!err || depth > 3) return false;
  const { message, code } = describe(err);
  if (OFFLINE_CODES.has(code)) return true;
  const lower = message.toLowerCase();
  if (OFFLINE_PATTERNS.some((p) => lower.includes(p))) return true;
  const cause =
    typeof err === 'object' ? (err as { cause?: unknown }).cause : undefined;
  return isOfflineError(cause, depth + 1);
}

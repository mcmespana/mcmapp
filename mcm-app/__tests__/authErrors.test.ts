/**
 * Tests de `utils/authErrors.ts` — la tabla que traduce los códigos de las
 * tres capas (módulo nativo de Google, expo-apple-authentication y Firebase)
 * a los códigos propios que consume la UI.
 *
 * Es la pieza que decide si un fallo de login se cuenta como "el usuario
 * canceló" (silencio) o como error de verdad (toast), así que los códigos
 * concretos importan: `12501` es la cancelación de Android y `10` el
 * DEVELOPER_ERROR que sale cuando falta la huella SHA-1 en Firebase.
 */
import {
  AUTH_ERROR,
  AuthError,
  authErrorCode,
  authErrorMessage,
  isCancelledAuthError,
  toAuthError,
} from '@/utils/authErrors';

/** Error al estilo de los módulos nativos: `Error` + propiedad `code`. */
const coded = (code: string | number, message = 'boom') =>
  Object.assign(new Error(message), { code });

describe('authErrorCode', () => {
  it('trata como cancelación los códigos de Android, iOS, Apple y Firebase', () => {
    const cancelCodes = [
      '12501', // GoogleSignInStatusCodes.SIGN_IN_CANCELLED (Android)
      'SIGN_IN_CANCELLED',
      'ERR_CANCELED', // Google Sign-In iOS
      'ERR_REQUEST_CANCELED', // expo-apple-authentication
      'auth/popup-closed-by-user', // Firebase web
      'auth/cancelled-popup-request',
      'auth/user-cancelled',
    ];
    for (const code of cancelCodes) {
      expect(authErrorCode(coded(code))).toBe(AUTH_ERROR.CANCELLED);
      expect(isCancelledAuthError(coded(code))).toBe(true);
    }
  });

  it('mapea DEVELOPER_ERROR (SHA-1 sin registrar) a error de configuración', () => {
    expect(authErrorCode(coded('10'))).toBe(AUTH_ERROR.MISCONFIGURED);
    expect(authErrorCode(coded('DEVELOPER_ERROR'))).toBe(
      AUTH_ERROR.MISCONFIGURED,
    );
    expect(authErrorCode(coded('12500'))).toBe(AUTH_ERROR.MISCONFIGURED);
  });

  it('reconoce Play Services y red', () => {
    expect(authErrorCode(coded('PLAY_SERVICES_NOT_AVAILABLE'))).toBe(
      AUTH_ERROR.PLAY_SERVICES,
    );
    expect(authErrorCode(coded('2'))).toBe(AUTH_ERROR.PLAY_SERVICES);
    expect(authErrorCode(coded('7'))).toBe(AUTH_ERROR.NETWORK);
    expect(authErrorCode(coded('auth/network-request-failed'))).toBe(
      AUTH_ERROR.NETWORK,
    );
  });

  it('reconoce el choque de proveedores en el mismo correo', () => {
    expect(
      authErrorCode(coded('auth/account-exists-with-different-credential')),
    ).toBe(AUTH_ERROR.ACCOUNT_EXISTS);
  });

  it('acepta códigos numéricos además de cadenas', () => {
    expect(authErrorCode(coded(10))).toBe(AUTH_ERROR.MISCONFIGURED);
    expect(authErrorCode(coded(12501))).toBe(AUTH_ERROR.CANCELLED);
  });

  it('cae a cancelación si solo el mensaje lo delata', () => {
    expect(authErrorCode(new Error('The user canceled the request'))).toBe(
      AUTH_ERROR.CANCELLED,
    );
  });

  it('devuelve UNKNOWN para lo que no reconoce', () => {
    expect(authErrorCode(coded('SOMETHING_ELSE', 'vaya'))).toBe(
      AUTH_ERROR.UNKNOWN,
    );
    expect(authErrorCode(null)).toBe(AUTH_ERROR.UNKNOWN);
    expect(authErrorCode(undefined)).toBe(AUTH_ERROR.UNKNOWN);
    expect(authErrorCode('un string suelto')).toBe(AUTH_ERROR.UNKNOWN);
  });

  it('respeta el código de un AuthError ya normalizado', () => {
    const err = new AuthError(AUTH_ERROR.GOOGLE_UNAVAILABLE, 'sin módulo');
    expect(authErrorCode(err)).toBe(AUTH_ERROR.GOOGLE_UNAVAILABLE);
  });
});

describe('toAuthError', () => {
  it('envuelve el error original conservando la causa', () => {
    const original = coded('10');
    const wrapped = toAuthError(original);
    expect(wrapped).toBeInstanceOf(AuthError);
    expect(wrapped.code).toBe(AUTH_ERROR.MISCONFIGURED);
    expect(wrapped.cause).toBe(original);
  });

  it('no vuelve a envolver un AuthError', () => {
    const err = new AuthError(AUTH_ERROR.CANCELLED, 'cancelado');
    expect(toAuthError(err)).toBe(err);
  });
});

describe('authErrorMessage', () => {
  it('da un mensaje distinto y no vacío para cada código', () => {
    const messages = Object.values(AUTH_ERROR).map((code) =>
      authErrorMessage(new AuthError(code, '')),
    );
    for (const message of messages) {
      expect(message.length).toBeGreaterThan(0);
    }
    expect(new Set(messages).size).toBe(messages.length);
  });

  it('menciona Play Services cuando falta en el dispositivo', () => {
    expect(authErrorMessage(coded('PLAY_SERVICES_NOT_AVAILABLE'))).toMatch(
      /Play Services/i,
    );
  });

  it('cae al mensaje genérico si el error es desconocido', () => {
    expect(authErrorMessage(coded('???'))).toBe('No se pudo iniciar sesión');
  });
});

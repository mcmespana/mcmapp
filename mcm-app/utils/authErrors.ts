/**
 * Normalización de errores de login (Google / Apple) para las tres
 * plataformas.
 *
 * Cada capa lanza sus propios códigos: el módulo nativo de Google usa enteros
 * de `CommonStatusCodes` como cadena ("10", "7", "12501"), expo-apple-
 * authentication usa `ERR_REQUEST_CANCELED`, y Firebase usa `auth/...`. Aquí
 * se traducen TODOS a un puñado de códigos propios (`AuthErrorCode`) para que
 * la UI decida qué decir sin repetir la tabla en cada pantalla.
 *
 * Es un módulo puro a propósito (sin imports nativos): así se puede testear y
 * se puede importar desde web, iOS y Android.
 */

export const AUTH_ERROR = {
  /** El usuario cerró el selector de cuenta: no es un fallo. */
  CANCELLED: 'ERR_CANCELED',
  /** El binario no incluye el módulo nativo (Expo Go / dev client viejo). */
  GOOGLE_UNAVAILABLE: 'ERR_GOOGLE_UNAVAILABLE',
  /** Falta configuración: SHA-1 sin registrar, client ID ausente, etc. */
  MISCONFIGURED: 'ERR_AUTH_MISCONFIGURED',
  /** Google Play Services ausente o desactualizado (solo Android). */
  PLAY_SERVICES: 'ERR_PLAY_SERVICES',
  /** Sin conexión o la petición al proveedor no llegó. */
  NETWORK: 'ERR_AUTH_NETWORK',
  /** Ya hay un login en curso (doble toque). */
  IN_PROGRESS: 'ERR_AUTH_IN_PROGRESS',
  /** Ese correo ya existe con otro proveedor. */
  ACCOUNT_EXISTS: 'ERR_ACCOUNT_EXISTS',
  /** Apple Sign-In no existe en esta plataforma. */
  APPLE_UNSUPPORTED: 'ERR_APPLE_UNSUPPORTED',
  /** Cualquier otra cosa. */
  UNKNOWN: 'ERR_AUTH_UNKNOWN',
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR)[keyof typeof AUTH_ERROR];

/** Error de login ya normalizado. Conserva la causa original para el log. */
export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly cause?: unknown;

  constructor(code: AuthErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Códigos nativos/Firebase → código propio.
 *
 * Los números son los de `CommonStatusCodes` de Google Play Services, que el
 * módulo Android reporta como cadena.
 */
const CODE_MAP: Record<string, AuthErrorCode> = {
  // ── Cancelaciones ──────────────────────────────────────────────────
  '12501': AUTH_ERROR.CANCELLED, // GoogleSignInStatusCodes.SIGN_IN_CANCELLED
  SIGN_IN_CANCELLED: AUTH_ERROR.CANCELLED,
  ERR_CANCELED: AUTH_ERROR.CANCELLED,
  ERR_REQUEST_CANCELED: AUTH_ERROR.CANCELLED, // expo-apple-authentication
  'auth/popup-closed-by-user': AUTH_ERROR.CANCELLED,
  'auth/cancelled-popup-request': AUTH_ERROR.CANCELLED,
  'auth/user-cancelled': AUTH_ERROR.CANCELLED,

  // ── Configuración ──────────────────────────────────────────────────
  '10': AUTH_ERROR.MISCONFIGURED, // DEVELOPER_ERROR — huella SHA-1 sin registrar
  DEVELOPER_ERROR: AUTH_ERROR.MISCONFIGURED,
  '12500': AUTH_ERROR.MISCONFIGURED, // SIGN_IN_FAILED
  'auth/operation-not-allowed': AUTH_ERROR.MISCONFIGURED,
  'auth/invalid-credential': AUTH_ERROR.MISCONFIGURED,
  'auth/unauthorized-domain': AUTH_ERROR.MISCONFIGURED,
  'auth/invalid-api-key': AUTH_ERROR.MISCONFIGURED,

  // ── Play Services ──────────────────────────────────────────────────
  PLAY_SERVICES_NOT_AVAILABLE: AUTH_ERROR.PLAY_SERVICES,
  '2': AUTH_ERROR.PLAY_SERVICES, // SERVICE_VERSION_UPDATE_REQUIRED
  '9': AUTH_ERROR.PLAY_SERVICES, // SERVICE_INVALID

  // ── Red ────────────────────────────────────────────────────────────
  '7': AUTH_ERROR.NETWORK, // NETWORK_ERROR
  NETWORK_ERROR: AUTH_ERROR.NETWORK,
  'auth/network-request-failed': AUTH_ERROR.NETWORK,
  'auth/timeout': AUTH_ERROR.NETWORK,

  // ── Otros ──────────────────────────────────────────────────────────
  ASYNC_OP_IN_PROGRESS: AUTH_ERROR.IN_PROGRESS,
  IN_PROGRESS: AUTH_ERROR.IN_PROGRESS,
  'auth/account-exists-with-different-credential': AUTH_ERROR.ACCOUNT_EXISTS,
  'auth/too-many-requests': AUTH_ERROR.NETWORK,
};

/** Mensajes de cara al usuario. Cortos: caben en un toast. */
const MESSAGES: Record<AuthErrorCode, string> = {
  [AUTH_ERROR.CANCELLED]: 'Has cancelado el inicio de sesión',
  [AUTH_ERROR.GOOGLE_UNAVAILABLE]:
    'Esta versión de la app no admite el inicio de sesión. Actualízala.',
  [AUTH_ERROR.MISCONFIGURED]:
    'El inicio de sesión no está disponible ahora mismo. Inténtalo más tarde.',
  [AUTH_ERROR.PLAY_SERVICES]:
    'Necesitas Google Play Services actualizado para entrar con Google',
  [AUTH_ERROR.NETWORK]:
    'Sin conexión. Comprueba tu internet e inténtalo otra vez.',
  [AUTH_ERROR.IN_PROGRESS]: 'Ya hay un inicio de sesión en marcha',
  [AUTH_ERROR.ACCOUNT_EXISTS]:
    'Ese correo ya tiene cuenta con otro método. Entra con el que usaste la primera vez.',
  [AUTH_ERROR.APPLE_UNSUPPORTED]:
    'Entrar con Apple solo está disponible en iPhone, iPad y web',
  [AUTH_ERROR.UNKNOWN]: 'No se pudo iniciar sesión',
};

/** Extrae el código de un error de cualquier capa (nativo, Firebase, propio). */
function rawCode(err: unknown): string {
  if (err && typeof err === 'object') {
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string') return code;
    if (typeof code === 'number') return String(code);
  }
  return '';
}

/**
 * Traduce cualquier error de login al código propio correspondiente. Si el
 * error ya viene normalizado (`AuthError`) se respeta su código.
 */
export function authErrorCode(err: unknown): AuthErrorCode {
  if (err instanceof AuthError) return err.code;
  const code = rawCode(err);
  const mapped = CODE_MAP[code];
  if (mapped) return mapped;
  // Algunos SDK solo dejan rastro de la cancelación en el mensaje.
  const message = String(
    (err as { message?: unknown })?.message ?? '',
  ).toLowerCase();
  if (message.includes('cancel')) return AUTH_ERROR.CANCELLED;
  return AUTH_ERROR.UNKNOWN;
}

/** Convierte cualquier error en un `AuthError` con código y mensaje útiles. */
export function toAuthError(err: unknown): AuthError {
  if (err instanceof AuthError) return err;
  const code = authErrorCode(err);
  return new AuthError(code, MESSAGES[code], err);
}

/** `true` si el usuario simplemente cerró el diálogo: no hay que avisar. */
export function isCancelledAuthError(err: unknown): boolean {
  return authErrorCode(err) === AUTH_ERROR.CANCELLED;
}

/** Mensaje listo para el toast a partir de un error de cualquier capa. */
export function authErrorMessage(err: unknown): string {
  return MESSAGES[authErrorCode(err)];
}

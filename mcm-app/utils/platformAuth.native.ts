// Implementación nativa (iOS + Android): usa
// @react-native-google-signin/google-signin y expo-apple-authentication.
//
// IMPORTANTE: el módulo nativo @react-native-google-signin/google-signin se
// carga de forma PEREZOSA para que la app no se caiga al arrancar en un
// binario que todavía no incluye el módulo nativo (Expo Go o un dev client sin
// recompilar). El error solo aparecerá —de forma controlada— si el usuario
// intenta iniciar sesión con Google.
import { Platform } from 'react-native';
import { logger } from '@/utils/logger';
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  updateProfile,
} from 'firebase/auth';
import type { Auth, UserCredential } from 'firebase/auth';
import { AUTH_ERROR, AuthError, toAuthError } from '@/utils/authErrors';

// Carga perezosa del módulo nativo de Google Sign-In. Es un `require` dentro
// de la función (y no un `import` arriba) a propósito: Metro no hace code
// splitting, así que lo único que importa es CUÁNDO se evalúa el módulo, y
// así no se evalúa hasta el primer intento de login.
function getGoogleSignin() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-google-signin/google-signin') as
      typeof import('@react-native-google-signin/google-signin') | undefined;
    if (!mod?.GoogleSignin) throw new Error('GoogleSignin no exportado');
    return mod.GoogleSignin;
  } catch (err) {
    throw new AuthError(
      AUTH_ERROR.GOOGLE_UNAVAILABLE,
      'El módulo nativo de Google Sign-In no está en este binario',
      err,
    );
  }
}

/** Igual que arriba, para expo-apple-authentication. */
function getAppleAuthentication() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-apple-authentication') as typeof import('expo-apple-authentication');
}

/**
 * `GoogleSignin.configure()` es síncrono pero deja una promesa interna que
 * `signIn()` espera. Aun así lo envolvemos en una promesa cacheada propia
 * para que un toque en el botón ANTES de que termine el efecto de arranque
 * no se salte la configuración (en Android, sin `webClientId` no hay
 * `idToken` y el login falla en silencio).
 */
let _configuredPromise: Promise<void> | null = null;

async function configureOnce(): Promise<void> {
  const GoogleSignin = getGoogleSignin();

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

  // El `webClientId` es el que pide el idToken que después valida Firebase.
  // En Android es imprescindible: sin él `signIn()` devuelve usuario pero sin
  // token, y Firebase no puede crear la sesión.
  if (!webClientId) {
    throw new AuthError(
      AUTH_ERROR.MISCONFIGURED,
      'Falta EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID en el build',
    );
  }

  GoogleSignin.configure({
    webClientId,
    // Solo iOS lo usa; en Android se ignora, pero no lo mandamos si no está
    // definido para no ensuciar la config nativa con `undefined`.
    ...(Platform.OS === 'ios' && iosClientId ? { iosClientId } : {}),
    offlineAccess: false,
    scopes: ['profile', 'email'],
  });
}

/** Configura Google Sign-In una sola vez; reintenta si la anterior falló. */
export function ensureGoogleSignInConfigured(): Promise<void> {
  if (!_configuredPromise) {
    _configuredPromise = configureOnce().catch((err) => {
      _configuredPromise = null;
      throw err;
    });
  }
  return _configuredPromise;
}

/**
 * Configuración de arranque (la llama `AuthContext` al montar). No propaga:
 * si el binario no trae el módulo nativo, la app tiene que seguir arrancando
 * igual y el fallo se verá —con mensaje— al pulsar el botón.
 */
export async function configureGoogleSignIn(): Promise<void> {
  try {
    await ensureGoogleSignInConfigured();
  } catch (err) {
    if (__DEV__) {
      logger.warn(
        '[platformAuth] Google Sign-In no se pudo configurar al arrancar:',
        err,
      );
    }
  }
}

export async function doGoogleSignIn(auth: Auth): Promise<UserCredential> {
  try {
    await ensureGoogleSignInConfigured();
    const GoogleSignin = getGoogleSignin();

    // Solo Android: en iOS la llamada es un no-op que devuelve true.
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
    }

    // A partir de v13 una cancelación NO lanza: devuelve
    // `{ type: 'cancelled', data: null }`. En versiones/rutas antiguas sí
    // lanzaba (`12501` en Android, `ERR_CANCELED` en iOS) — `toAuthError`
    // normaliza ambos casos al mismo código.
    const response = await GoogleSignin.signIn();
    if (response?.type === 'cancelled') {
      throw new AuthError(AUTH_ERROR.CANCELLED, 'Google Sign-In cancelado');
    }

    const idToken = response.data?.idToken;
    if (!idToken) {
      // Pasa cuando el `webClientId` no corresponde al proyecto de Firebase.
      throw new AuthError(
        AUTH_ERROR.MISCONFIGURED,
        'Google Sign-In: no se recibió idToken',
      );
    }

    const credential = GoogleAuthProvider.credential(idToken);
    return await signInWithCredential(auth, credential);
  } catch (err) {
    throw toAuthError(err);
  }
}

/** `true` si el dispositivo puede usar "Continuar con Apple". */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await getAppleAuthentication().isAvailableAsync();
  } catch {
    return false;
  }
}

export async function doAppleSignIn(auth: Auth): Promise<UserCredential> {
  try {
    if (Platform.OS !== 'ios') {
      throw new AuthError(
        AUTH_ERROR.APPLE_UNSUPPORTED,
        'Apple Sign-In no está disponible en esta plataforma',
      );
    }

    const AppleAuthentication = getAppleAuthentication();
    const appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!appleCredential.identityToken) {
      throw new AuthError(
        AUTH_ERROR.MISCONFIGURED,
        'Apple Sign-In: no se recibió identityToken',
      );
    }

    const provider = new OAuthProvider('apple.com');
    const oauthCredential = provider.credential({
      idToken: appleCredential.identityToken,
    });
    const result = await signInWithCredential(auth, oauthCredential);

    // Apple solo envía el nombre en el primer login — actualizar perfil Firebase si falta
    if (!result.user.displayName && appleCredential.fullName) {
      const name = [
        appleCredential.fullName.givenName,
        appleCredential.fullName.familyName,
      ]
        .filter(Boolean)
        .join(' ');
      if (name) {
        await updateProfile(result.user, { displayName: name });
        // Reload to get the updated displayName
        await result.user.reload();
      }
    }

    return result;
  } catch (err) {
    throw toAuthError(err);
  }
}

export async function doGoogleSignOut(): Promise<void> {
  try {
    await getGoogleSignin().signOut();
  } catch {
    // Ignorar errores al cerrar sesión de Google
  }
}

// Native implementation: uses @react-native-google-signin/google-signin and
// expo-apple-authentication.
//
// IMPORTANTE: el módulo nativo @react-native-google-signin/google-signin se
// importa de forma PEREZOSA (dynamic import) para que la app no se caiga al
// arrancar en un binario que todavía no incluye el módulo nativo (Expo Go o
// un dev client sin recompilar). El error solo aparecerá —de forma
// controlada— si el usuario intenta iniciar sesión con Google.
import { logger } from '@/utils/logger';
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  updateProfile,
} from 'firebase/auth';
import type { Auth, UserCredential } from 'firebase/auth';

// Carga perezosa y cacheada del módulo nativo de Google Sign-In.
let _googleSigninPromise: Promise<
  typeof import('@react-native-google-signin/google-signin')
> | null = null;

async function getGoogleSignin() {
  if (!_googleSigninPromise) {
    _googleSigninPromise = import('@react-native-google-signin/google-signin');
  }
  const mod = await _googleSigninPromise;
  return mod.GoogleSignin;
}

export async function configureGoogleSignIn(): Promise<void> {
  try {
    const GoogleSignin = await getGoogleSignin();
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      offlineAccess: false,
      scopes: ['profile', 'email'],
    });
  } catch (err) {
    // El módulo nativo no está disponible en este binario — se degrada en
    // silencio; el botón de Google fallará con un mensaje controlado.
    if (__DEV__) {
      logger.warn(
        '[platformAuth] Google Sign-In nativo no disponible en este binario:',
        err,
      );
    }
  }
}

export async function doGoogleSignIn(auth: Auth): Promise<UserCredential> {
  const GoogleSignin = await getGoogleSignin();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  let response;
  try {
    response = await GoogleSignin.signIn();
  } catch (err: any) {
    // En Android, cerrar el selector de cuenta lanza SIGN_IN_CANCELLED.
    // Lo normalizamos a ERR_CANCELED para que la capa superior (AuthContext)
    // lo trate como cancelación y NO muestre un toast de error.
    if (
      err?.code === '12501' || // statusCodes.SIGN_IN_CANCELLED (Android)
      err?.code === 'SIGN_IN_CANCELLED' ||
      err?.code === 'ERR_CANCELED'
    ) {
      const cancelled: any = new Error('Google Sign-In cancelado');
      cancelled.code = 'ERR_CANCELED';
      throw cancelled;
    }
    throw err;
  }
  // En @react-native-google-signin v13+ una cancelación NO lanza: devuelve
  // `{ type: 'cancelled', data: null }`. La detectamos para no tratarla como
  // un fallo real.
  if (response?.type === 'cancelled') {
    const cancelled: any = new Error('Google Sign-In cancelado');
    cancelled.code = 'ERR_CANCELED';
    throw cancelled;
  }
  if (!response.data?.idToken) {
    throw new Error('Google Sign-In: no se recibió idToken');
  }
  const credential = GoogleAuthProvider.credential(response.data.idToken);
  return await signInWithCredential(auth, credential);
}

export async function doAppleSignIn(auth: Auth): Promise<UserCredential> {
  const AppleAuthentication = await import('expo-apple-authentication');
  const appleCredential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!appleCredential.identityToken) {
    throw new Error('Apple Sign-In: no se recibió identityToken');
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
}

export async function doGoogleSignOut(): Promise<void> {
  try {
    const GoogleSignin = await getGoogleSignin();
    await GoogleSignin.signOut();
  } catch {
    // Ignorar errores al cerrar sesión de Google
  }
}

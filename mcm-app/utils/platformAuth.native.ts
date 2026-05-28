// Native implementation: uses @react-native-google-signin/google-signin and
// expo-apple-authentication.
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  updateProfile,
} from 'firebase/auth';
import type { Auth, UserCredential } from 'firebase/auth';

export async function configureGoogleSignIn(): Promise<void> {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    offlineAccess: false,
    scopes: ['profile', 'email'],
  });
}

export async function doGoogleSignIn(auth: Auth): Promise<UserCredential> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
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
    await GoogleSignin.signOut();
  } catch {
    // Ignorar errores al cerrar sesión de Google
  }
}

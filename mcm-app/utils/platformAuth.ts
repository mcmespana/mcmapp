// Web implementation: uses Firebase signInWithPopup for both Google and Apple.
import {
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
} from 'firebase/auth';
import type { Auth, UserCredential } from 'firebase/auth';
import { toAuthError } from '@/utils/authErrors';

export async function configureGoogleSignIn(): Promise<void> {
  // No-op on web — Google Sign-In is handled by Firebase signInWithPopup
}

export async function ensureGoogleSignInConfigured(): Promise<void> {
  // No-op on web — see above
}

export async function doGoogleSignIn(auth: Auth): Promise<UserCredential> {
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    return await signInWithPopup(auth, provider);
  } catch (err) {
    throw toAuthError(err);
  }
}

/** En web el flujo de Apple es el popup de Firebase: siempre disponible. */
export async function isAppleSignInAvailable(): Promise<boolean> {
  return true;
}

export async function doAppleSignIn(auth: Auth): Promise<UserCredential> {
  try {
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    return await signInWithPopup(auth, provider);
  } catch (err) {
    throw toAuthError(err);
  }
}

export async function doGoogleSignOut(): Promise<void> {
  // No-op on web
}

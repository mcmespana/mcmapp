// Web implementation: uses Firebase signInWithPopup for both Google and Apple.
import { signInWithPopup, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import type { Auth, UserCredential } from 'firebase/auth';

export async function configureGoogleSignIn(): Promise<void> {
  // No-op on web — Google Sign-In is handled by Firebase signInWithPopup
}

export async function doGoogleSignIn(auth: Auth): Promise<UserCredential> {
  const provider = new GoogleAuthProvider();
  provider.addScope('profile');
  provider.addScope('email');
  return await signInWithPopup(auth, provider);
}

export async function doAppleSignIn(auth: Auth): Promise<UserCredential> {
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  return await signInWithPopup(auth, provider);
}

export async function doGoogleSignOut(): Promise<void> {
  // No-op on web
}

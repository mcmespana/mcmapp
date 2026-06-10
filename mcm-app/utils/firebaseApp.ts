import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { firebaseConfig } from '@/constants/firebase';

/** Thrown when EXPO_PUBLIC_FIREBASE_* env vars are missing from the build. */
export class FirebaseConfigError extends Error {
  constructor(missingVars: string[]) {
    super(
      `Firebase config incompleta. Variables de entorno vacías: ${missingVars.join(', ')}. ` +
        `Revisa los EAS Secrets del proyecto (npx eas-cli secret:list) y los GitHub Secrets del repo.`,
    );
    this.name = 'FirebaseConfigError';
  }
}

export function getFirebaseApp(): FirebaseApp {
  if (!getApps().length) {
    const missing = (
      Object.entries(firebaseConfig) as [string, string | undefined][]
    )
      .filter(([, v]) => !v)
      .map(([k]) => `EXPO_PUBLIC_FIREBASE_${k.toUpperCase()}`);

    if (missing.length) {
      throw new FirebaseConfigError(missing);
    }

    initializeApp(firebaseConfig);
  }
  return getApps()[0];
}

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { firebaseConfig } from '@/constants/firebase';

export function getFirebaseApp(): FirebaseApp {
  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }
  return getApps()[0];
}

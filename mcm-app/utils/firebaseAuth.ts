import { getAuth } from 'firebase/auth';
import { getFirebaseApp } from '@/utils/firebaseApp';

export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

import {
  initializeAuth,
  getReactNativePersistence,
  getAuth,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseApp } from '@/utils/firebaseApp';

let _auth: ReturnType<typeof getAuth> | null = null;

export function getFirebaseAuth() {
  if (_auth) return _auth;
  try {
    _auth = initializeAuth(getFirebaseApp(), {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Auth already initialized (e.g. hot reload)
    _auth = getAuth(getFirebaseApp());
  }
  return _auth;
}

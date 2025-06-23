import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native'; // 👈 importante para detectar si estamos en web o nativo
import { firebaseConfig } from '@/constants/firebase';

let app: FirebaseApp;
let authInitialized = false;

export function getFirebaseApp(): FirebaseApp {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);

    if (Platform.OS !== 'web') {
      // Solo inicializar con AsyncStorage en móvil
      initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    }

    authInitialized = true;
  } else {
    app = getApps()[0];
  }

  return app;
}

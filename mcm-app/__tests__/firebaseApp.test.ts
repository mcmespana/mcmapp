/**
 * Tests de `utils/firebaseApp.ts`.
 *
 * Singleton de la app de Firebase. Si faltan variables de entorno
 * `EXPO_PUBLIC_FIREBASE_*` en el build, tiene que fallar con un
 * `FirebaseConfigError` explícito (qué variable falta) en vez de dejar que
 * Firebase reviente más abajo con un error críptico.
 */
import { initializeApp, getApps } from 'firebase/app';
import { getFirebaseApp, FirebaseConfigError } from '@/utils/firebaseApp';

let mockConfig: Record<string, string | undefined> = {
  apiKey: 'key',
  authDomain: 'domain',
  databaseURL: 'db-url',
  projectId: 'project',
  storageBucket: 'bucket',
  messagingSenderId: 'sender',
  appId: 'app-id',
};

jest.mock('@/constants/firebase', () => ({
  get firebaseConfig() {
    return mockConfig;
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockConfig = {
    apiKey: 'key',
    authDomain: 'domain',
    databaseURL: 'db-url',
    projectId: 'project',
    storageBucket: 'bucket',
    messagingSenderId: 'sender',
    appId: 'app-id',
  };
});

describe('getFirebaseApp', () => {
  it('no inicializa de nuevo si ya hay una app registrada', () => {
    (getApps as jest.Mock).mockReturnValue([{ name: 'existing' }]);
    const app = getFirebaseApp();
    expect(initializeApp).not.toHaveBeenCalled();
    expect(app).toEqual({ name: 'existing' });
  });

  it('inicializa con la config cuando no hay ninguna app aún', () => {
    (getApps as jest.Mock)
      .mockReturnValueOnce([])
      .mockReturnValue([{ name: 'new-app' }]);
    const app = getFirebaseApp();
    expect(initializeApp).toHaveBeenCalledWith(mockConfig);
    expect(app).toEqual({ name: 'new-app' });
  });

  it('lanza FirebaseConfigError si falta una variable', () => {
    (getApps as jest.Mock).mockReturnValue([]);
    mockConfig = { ...mockConfig, apiKey: undefined };
    expect(() => getFirebaseApp()).toThrow(FirebaseConfigError);
    expect(initializeApp).not.toHaveBeenCalled();
  });

  it('el mensaje de error lista las variables EXPO_PUBLIC_FIREBASE_* que faltan', () => {
    (getApps as jest.Mock).mockReturnValue([]);
    mockConfig = { ...mockConfig, apiKey: undefined, projectId: '' };
    try {
      getFirebaseApp();
      throw new Error('se esperaba que lanzara');
    } catch (err) {
      expect(err).toBeInstanceOf(FirebaseConfigError);
      expect((err as Error).message).toContain(
        'EXPO_PUBLIC_FIREBASE_APIKEY',
      );
      expect((err as Error).message).toContain(
        'EXPO_PUBLIC_FIREBASE_PROJECTID',
      );
    }
  });

  it('no lanza si todas las variables están presentes', () => {
    (getApps as jest.Mock).mockReturnValue([]);
    expect(() => getFirebaseApp()).not.toThrow();
  });
});

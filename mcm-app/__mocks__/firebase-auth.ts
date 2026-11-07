/**
 * Mock de `firebase/auth`, mapeado en `jest.config.js` igual que `firebase/app`
 * y `firebase/database`.
 *
 * El paquete real se publica como ESM y Jest no lo transforma, así que
 * cualquier test que monte `AuthProvider` —o algo que lo contenga, como la
 * torre de `AppProviders`— moría con «Unexpected token 'export'» antes de
 * ejecutar una sola línea. Estaba resuelto a mano y suelto en
 * `authContext.test.tsx`; aquí vale para todos.
 *
 * `onAuthStateChanged` devuelve su función de baja y NO invoca el callback: el
 * estado por defecto es "sin sesión", que es el que ve la mayoría de la gente.
 * Un test que quiera un usuario dentro puede sobrescribirlo con
 * `jest.mock('firebase/auth', …)` en su propio fichero.
 */
export const onAuthStateChanged = jest.fn(() => jest.fn());
export const signOut = jest.fn(() => Promise.resolve());
export const deleteUser = jest.fn(() => Promise.resolve());
export const getAuth = jest.fn(() => ({ currentUser: null }));
export const initializeAuth = jest.fn(() => ({ currentUser: null }));
export const getReactNativePersistence = jest.fn(() => ({}));
export const signInWithCredential = jest.fn(() =>
  Promise.resolve({ user: { uid: 'mock-uid' } }),
);
export const signInWithPopup = jest.fn(() =>
  Promise.resolve({ user: { uid: 'mock-uid' } }),
);
export const GoogleAuthProvider = {
  credential: jest.fn(() => ({ providerId: 'google.com' })),
};
export const OAuthProvider = jest.fn(() => ({
  credential: jest.fn(() => ({ providerId: 'apple.com' })),
}));
export const browserPopupRedirectResolver = {};

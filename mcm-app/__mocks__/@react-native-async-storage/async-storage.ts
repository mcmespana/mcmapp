/**
 * Mock de AsyncStorage para tests.
 * Simula el almacenamiento local en memoria.
 */

const store: Record<string, string> = {};

const AsyncStorage = {
  getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    store[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete store[key];
    return Promise.resolve();
  }),
  // Sin esto, el código que descarta varias claves de golpe (p. ej. la caché
  // corrupta de `useFirebaseData`) revienta con "multiRemove is not a
  // function" solo bajo Jest, y el test mide ese TypeError en vez del
  // comportamiento real.
  multiRemove: jest.fn((keys: string[]) => {
    keys.forEach((key) => delete store[key]);
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    Object.keys(store).forEach((key) => delete store[key]);
    return Promise.resolve();
  }),
};

export default AsyncStorage;

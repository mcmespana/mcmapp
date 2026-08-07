/**
 * Mock de Firebase para tests.
 * Simula las funciones de Firebase que usa la app sin necesidad de conexión real.
 */

// Mock de firebase/app
export const initializeApp = jest.fn(() => ({}));
export const getApps = jest.fn(() => [{}]);

// Mock de firebase/database
const mockSnapshot = {
  exists: jest.fn(() => true),
  val: jest.fn(() => ({
    updatedAt: '12345',
    data: { test: 'data' },
  })),
};

export const getDatabase = jest.fn(() => ({}));
export const ref = jest.fn(() => ({}));
export const get = jest.fn(() => Promise.resolve(mockSnapshot));
export const set = jest.fn(() => Promise.resolve());
// `push` devuelve una referencia hija con `key`, como el SDK real. Lo usa
// `services/firebaseWrites.ts` (la key se genera una vez y el retry reintenta
// solo el `set`, así que los tests necesitan poder mirar cuántas veces se llamó).
let pushCounter = 0;
export const push = jest.fn(() => ({ key: `mock-key-${++pushCounter}` }));
export const update = jest.fn(() => Promise.resolve());
export const remove = jest.fn(() => Promise.resolve());
export const onValue = jest.fn(() => jest.fn());
export const off = jest.fn();

// Helper para cambiar lo que devuelve Firebase en cada test
export const __setMockSnapshot = (data: any) => {
  mockSnapshot.val.mockReturnValue(data);
  mockSnapshot.exists.mockReturnValue(data !== null);
};

export const __resetMocks = () => {
  pushCounter = 0;
  initializeApp.mockClear();
  getApps.mockClear();
  getDatabase.mockClear();
  ref.mockClear();
  get.mockClear();
  mockSnapshot.exists.mockReturnValue(true);
  mockSnapshot.val.mockReturnValue({
    updatedAt: '12345',
    data: { test: 'data' },
  });
};

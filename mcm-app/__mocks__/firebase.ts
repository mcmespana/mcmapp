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

// Helper para cambiar lo que devuelve Firebase en cada test
export const __setMockSnapshot = (data: any) => {
  mockSnapshot.val.mockReturnValue(data);
  mockSnapshot.exists.mockReturnValue(data !== null);
};

export const __resetMocks = () => {
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

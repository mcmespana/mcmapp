/**
 * Mock de expo-network para tests.
 * Simula el estado de la red sin necesidad de dispositivo real.
 */

let mockNetworkState = {
  isConnected: true,
  isInternetReachable: true,
  type: 'wifi',
};

const listeners: Array<(state: typeof mockNetworkState) => void> = [];

export const getNetworkStateAsync = jest.fn(() =>
  Promise.resolve(mockNetworkState),
);

export const addNetworkStateListener = jest.fn((callback) => {
  listeners.push(callback);
  return { remove: jest.fn() };
});

// Helper para simular cambios de red en tests
export const __setNetworkState = (state: Partial<typeof mockNetworkState>) => {
  mockNetworkState = { ...mockNetworkState, ...state };
};

export const __triggerNetworkChange = () => {
  listeners.forEach((l) => l(mockNetworkState));
};

/**
 * Test de `hooks/useShakeDetector.ts`.
 *
 * Solo cubre las dos guardas de plataforma/`enabled`: la lógica interna del
 * acelerómetro vive detrás de un `import('expo-sensors')` dinámico que, bajo
 * Jest, no se transforma a CommonJS (mismo problema documentado en
 * `platformAuthNative.test.ts`) — el import nunca resuelve al mock y cae
 * siempre por el `.catch()` en silencio. Ejercitar esa rama sin tocar el
 * hook para cambiar el import por un `require` perezoso no es posible.
 */
import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { useShakeDetector } from '@/hooks/useShakeDetector';

const mockAddListener = jest.fn();

jest.mock('expo-sensors', () => ({
  Accelerometer: {
    setUpdateInterval: jest.fn(),
    addListener: (...args: unknown[]) => mockAddListener(...args),
  },
}));

beforeEach(() => {
  Platform.OS = 'ios';
  mockAddListener.mockClear();
});

describe('useShakeDetector', () => {
  it('no se suscribe en web', async () => {
    Platform.OS = 'web';
    await renderHook(() => useShakeDetector(jest.fn()));
    await new Promise((r) => setTimeout(r, 20));
    expect(mockAddListener).not.toHaveBeenCalled();
  });

  it('no se suscribe si enabled: false', async () => {
    await renderHook(() => useShakeDetector(jest.fn(), { enabled: false }));
    await new Promise((r) => setTimeout(r, 20));
    expect(mockAddListener).not.toHaveBeenCalled();
  });

  it('no revienta al montar/desmontar con enabled: true (degradado sin el módulo nativo)', async () => {
    const { unmount } = await renderHook(() =>
      useShakeDetector(jest.fn(), { enabled: true }),
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(() => unmount()).not.toThrow();
  });
});

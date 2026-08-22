/**
 * Tests de `hooks/useShakeDetector.ts`.
 *
 * Detecta un "shake" del dispositivo contando picos de aceleración por
 * encima de un umbral dentro de una ventana de tiempo. Si el cálculo de
 * magnitud, la ventana o el cooldown fallan, el easter egg salta con
 * cualquier movimiento o nunca salta agitando de verdad.
 *
 * `expo-sensors` se carga con `require()` dentro del efecto (no `import()`
 * dinámico: bajo Jest no se transforma bien a CommonJS y nunca resolvía a un
 * mock — ver CHANGELOG). Al ser síncrono, `jest.mock` sí lo intercepta.
 */
import { renderHook, act } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { useShakeDetector } from '@/hooks/useShakeDetector';

let mockListener:
  | ((data: { x: number; y: number; z: number }) => void)
  | null = null;
const mockRemove = jest.fn();
const mockSetUpdateInterval = jest.fn();
const mockAddListener = jest.fn((...args: unknown[]) => {
  mockListener = args[0] as typeof mockListener;
  return { remove: mockRemove };
});

jest.mock('expo-sensors', () => ({
  Accelerometer: {
    setUpdateInterval: (...args: unknown[]) => mockSetUpdateInterval(...args),
    addListener: (...args: unknown[]) => mockAddListener(...args),
  },
}));

// El hook arranca `lastFireAt` en 0 y compara `now - lastFireAt >= cooldownMs`
// para el primer disparo — en producción `Date.now()` siempre es un epoch
// gigante, así que esa resta nunca da un número pequeño. Aquí hay que evitar
// que los timestamps de prueba caigan cerca de 0, o el cooldown por defecto
// (1200ms) bloquearía el primer shake sin que sea un bug real.
const BASE_MS = 10_000_000;
let mockNow = BASE_MS;

beforeEach(() => {
  Platform.OS = 'ios';
  mockListener = null;
  mockNow = BASE_MS;
  mockRemove.mockClear();
  mockSetUpdateInterval.mockClear();
  mockAddListener.mockClear();
  jest.spyOn(Date, 'now').mockImplementation(() => mockNow);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// El callback del acelerómetro no dispara ningún re-render de React (el hook
// no hace `setState`), pero hay que envolverlo en un `act` ASÍNCRONO y
// esperado — un `act(() => ...)` sin `await` dejaba a React en un estado tal
// que el `renderHook` del siguiente test no llegaba a ejecutar su efecto.
async function fire(magnitude: number, atOffsetMs: number) {
  mockNow = BASE_MS + atOffsetMs;
  await act(async () => {
    mockListener?.({ x: magnitude, y: 0, z: 0 });
  });
}

describe('useShakeDetector', () => {
  it('no se suscribe en web', async () => {
    Platform.OS = 'web';
    await renderHook(() => useShakeDetector(jest.fn()));
    expect(mockAddListener).not.toHaveBeenCalled();
  });

  it('no se suscribe si enabled: false', async () => {
    await renderHook(() => useShakeDetector(jest.fn(), { enabled: false }));
    expect(mockAddListener).not.toHaveBeenCalled();
  });

  it('se suscribe con updateInterval 80ms en nativo', async () => {
    await renderHook(() => useShakeDetector(jest.fn()));
    expect(mockSetUpdateInterval).toHaveBeenCalledWith(80);
    expect(mockAddListener).toHaveBeenCalledTimes(1);
  });

  it('dispara onShake tras acumular los picos requeridos en la ventana', async () => {
    const onShake = jest.fn();
    await renderHook(() =>
      useShakeDetector(onShake, {
        threshold: 1.9,
        peaksRequired: 3,
        windowMs: 700,
      }),
    );
    await fire(2, 0);
    await fire(2, 100);
    await fire(2, 200);
    expect(onShake).toHaveBeenCalledTimes(1);
  });

  it('no dispara si los picos no llegan al umbral', async () => {
    const onShake = jest.fn();
    await renderHook(() =>
      useShakeDetector(onShake, { threshold: 1.9, peaksRequired: 3 }),
    );
    await fire(1, 0);
    await fire(1, 100);
    await fire(1, 200);
    expect(onShake).not.toHaveBeenCalled();
  });

  it('no dispara si faltan picos para llegar a peaksRequired', async () => {
    const onShake = jest.fn();
    await renderHook(() =>
      useShakeDetector(onShake, { threshold: 1.9, peaksRequired: 3 }),
    );
    await fire(2, 0);
    await fire(2, 100);
    expect(onShake).not.toHaveBeenCalled();
  });

  it('descarta picos fuera de la ventana de tiempo', async () => {
    const onShake = jest.fn();
    await renderHook(() =>
      useShakeDetector(onShake, {
        threshold: 1.9,
        peaksRequired: 3,
        windowMs: 500,
      }),
    );
    await fire(2, 0);
    await fire(2, 600); // el primer pico ya expiró (>500ms)
    await fire(2, 700);
    expect(onShake).not.toHaveBeenCalled();
  });

  it('respeta el cooldown entre detecciones', async () => {
    const onShake = jest.fn();
    await renderHook(() =>
      useShakeDetector(onShake, {
        threshold: 1.9,
        peaksRequired: 2,
        windowMs: 700,
        cooldownMs: 1000,
      }),
    );
    await fire(2, 0);
    await fire(2, 100);
    expect(onShake).toHaveBeenCalledTimes(1);

    await fire(2, 200);
    await fire(2, 300);
    // Dentro del cooldown: no vuelve a disparar.
    expect(onShake).toHaveBeenCalledTimes(1);

    await fire(2, 1300);
    await fire(2, 1400);
    expect(onShake).toHaveBeenCalledTimes(2);
  });

  it('usa siempre la última versión de onShake (ref)', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = await renderHook(
      ({ cb }: { cb: () => void }) =>
        useShakeDetector(cb, { peaksRequired: 1 }),
      { initialProps: { cb: first } },
    );
    await act(async () => rerender({ cb: second }));
    await fire(2, 0);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('re-suscribe si cambian threshold/peaksRequired/windowMs/cooldownMs', async () => {
    const { rerender } = await renderHook(
      ({ threshold }: { threshold: number }) =>
        useShakeDetector(jest.fn(), { threshold }),
      { initialProps: { threshold: 1.9 } },
    );
    expect(mockAddListener).toHaveBeenCalledTimes(1);
    await act(async () => rerender({ threshold: 2.5 }));
    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(mockAddListener).toHaveBeenCalledTimes(2);
  });

  it('se desuscribe al desmontar', async () => {
    const { unmount } = await renderHook(() => useShakeDetector(jest.fn()));
    await unmount();
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it('degrada en silencio si expo-sensors no está disponible (require lanza)', async () => {
    mockAddListener.mockImplementationOnce(() => {
      throw new Error('módulo nativo no disponible');
    });
    const onShake = jest.fn();
    const { unmount } = await renderHook(() => useShakeDetector(onShake));
    // No debe romper el montaje ni el desmontaje aunque el require/listener falle.
    await expect(unmount()).resolves.toBeUndefined();
  });
});

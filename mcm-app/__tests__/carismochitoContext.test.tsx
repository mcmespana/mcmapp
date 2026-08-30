/**
 * Tests de `contexts/CarismochitoContext.tsx` — el easter egg del modo
 * Carismochito, que se activa agitando el móvil.
 *
 * Es todo temporizadores y refs, y los fallos posibles son de los que no dan
 * error: activarse con menos sacudidas de la cuenta, no reiniciar la carga
 * cuando el usuario para, o quedarse activo tras confirmar la salida. También
 * se comprueba que los efectos colaterales (tema, icono del launcher,
 * persistencia, analítica) van con el estado y no por su cuenta.
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CarismochitoProvider,
  useCarismochito,
} from '@/contexts/CarismochitoContext';

jest.mock('@/utils/heroUIRuntimeTheme', () => ({
  setCarismochitoTheme: jest.fn(),
}));
jest.mock('@/utils/appIcon', () => ({ syncAppIcon: jest.fn() }));
jest.mock('@/utils/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/utils/haptics', () => ({
  h: {
    shake: jest.fn(),
    tap: jest.fn(),
    carismoOn: jest.fn(),
    carismoOff: jest.fn(),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { setCarismochitoTheme } = require('@/utils/heroUIRuntimeTheme');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { syncAppIcon } = require('@/utils/appIcon');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { trackEvent } = require('@/utils/analytics');

const STORAGE_KEY = '@carismochito_active';
const ONBOARDING_KEY = '@carismochito_onboarding_seen';
const SHAKES = 5;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <CarismochitoProvider>{children}</CarismochitoProvider>
);

async function mount() {
  const hook = await renderHook(() => useCarismochito(), { wrapper });
  // Deja resolver los dos getItem del efecto de arranque.
  await act(async () => {});
  return hook;
}

type Hook = Awaited<ReturnType<typeof mount>>;

/** Agita `n` veces seguidas. */
async function shake(hook: Hook, n = 1) {
  for (let i = 0; i < n; i++) {
    await act(async () => hook.result.current.toggleByShake());
  }
}

/** Agita lo justo para arrancar la cuenta atrás y la deja terminar. */
async function activar(hook: Hook) {
  await shake(hook, SHAKES);
  await act(async () => {
    jest.advanceTimersByTime(3000);
  });
}

/**
 * Activa y además cierra el onboarding, que la primera vez se abre solo. Con
 * un diálogo abierto las sacudidas se ignoran a propósito, así que los tests
 * de salida tienen que partir de un estado sin diálogos.
 */
async function activarSinDialogos(hook: Hook) {
  await activar(hook);
  await act(async () => hook.result.current.dismissOnboarding());
}

beforeEach(async () => {
  jest.useFakeTimers();
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('carga del modo con sacudidas', () => {
  it('arranca en idle y sin carga', async () => {
    const { result } = await mount();
    expect(result.current.state).toBe('idle');
    expect(result.current.chargeCount).toBe(0);
    expect(result.current.shakesNeeded).toBe(SHAKES);
    expect(result.current.isActive).toBe(false);
  });

  it('acumula sacudidas sin arrancar antes de tiempo', async () => {
    const hook = await mount();
    await shake(hook, SHAKES - 1);
    expect(hook.result.current.chargeCount).toBe(SHAKES - 1);
    expect(hook.result.current.state).toBe('idle');
  });

  it('a las 5 sacudidas arranca la cuenta atrás y resetea la carga', async () => {
    const hook = await mount();
    await shake(hook, SHAKES);
    expect(hook.result.current.state).toBe('countingDown');
    expect(hook.result.current.chargeCount).toBe(0);
    expect(hook.result.current.countdown).toBe(3);
  });

  it('la carga se olvida si el usuario para 2,5 s', async () => {
    const hook = await mount();
    await shake(hook, 3);
    await act(async () => {
      jest.advanceTimersByTime(2500);
    });
    expect(hook.result.current.chargeCount).toBe(0);
    await shake(hook, 3);
    expect(hook.result.current.state).toBe('idle');
  });
});

describe('cuenta atrás', () => {
  it('descuenta segundo a segundo hasta activar', async () => {
    const hook = await mount();
    await shake(hook, SHAKES);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(hook.result.current.countdown).toBe(2);
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(hook.result.current.state).toBe('active');
    expect(hook.result.current.isActive).toBe(true);
    expect(hook.result.current.freshlyActivated).toBe(true);
  });

  it('al activar: tema verde, icono, persistencia y analítica', async () => {
    const hook = await mount();
    await activar(hook);
    expect(setCarismochitoTheme).toHaveBeenLastCalledWith(true);
    expect(syncAppIcon).toHaveBeenLastCalledWith(true);
    expect(trackEvent).toHaveBeenCalledWith('carismochito_activado');
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe('1');
  });

  it('una sacudida durante la cuenta atrás la cancela', async () => {
    const hook = await mount();
    await shake(hook, SHAKES);
    await shake(hook, 1);
    expect(hook.result.current.state).toBe('idle');
    expect(hook.result.current.countdown).toBe(3);
    // Y el temporizador queda parado: pasar el tiempo no lo activa.
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(hook.result.current.state).toBe('idle');
  });

  it('cancelCountdown deja el estado listo para volver a intentarlo', async () => {
    const hook = await mount();
    await shake(hook, SHAKES);
    await act(async () => hook.result.current.cancelCountdown());
    expect(hook.result.current.state).toBe('idle');
    await activar(hook);
    expect(hook.result.current.state).toBe('active');
  });
});

describe('salir del modo', () => {
  it('hacen falta 2 sacudidas para pedir confirmación', async () => {
    const hook = await mount();
    await activarSinDialogos(hook);
    await shake(hook, 1);
    expect(hook.result.current.exitConfirmVisible).toBe(false);
    await shake(hook, 1);
    expect(hook.result.current.exitConfirmVisible).toBe(true);
    // Sigue activo: la salida aún no está confirmada.
    expect(hook.result.current.isActive).toBe(true);
  });

  it('las sacudidas de salida caducan a 1,5 s', async () => {
    const hook = await mount();
    await activarSinDialogos(hook);
    await shake(hook, 1);
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    await shake(hook, 1);
    expect(hook.result.current.exitConfirmVisible).toBe(false);
  });

  it('confirmExit desactiva y deshace los efectos', async () => {
    const hook = await mount();
    await activarSinDialogos(hook);
    await shake(hook, 2);
    await act(async () => hook.result.current.confirmExit());
    expect(hook.result.current.state).toBe('idle');
    expect(hook.result.current.isActive).toBe(false);
    expect(hook.result.current.exitConfirmVisible).toBe(false);
    expect(setCarismochitoTheme).toHaveBeenLastCalledWith(false);
    expect(syncAppIcon).toHaveBeenLastCalledWith(false);
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('cancelExit cierra el diálogo y mantiene el modo', async () => {
    const hook = await mount();
    await activarSinDialogos(hook);
    await shake(hook, 2);
    await act(async () => hook.result.current.cancelExit());
    expect(hook.result.current.exitConfirmVisible).toBe(false);
    expect(hook.result.current.isActive).toBe(true);
  });

  it('con un diálogo abierto las sacudidas no hacen nada', async () => {
    const hook = await mount();
    await activarSinDialogos(hook);
    await shake(hook, 2); // abre la confirmación
    await shake(hook, 5);
    expect(hook.result.current.isActive).toBe(true);
    expect(hook.result.current.exitConfirmVisible).toBe(true);
  });

  it('deactivate directo también limpia todo', async () => {
    const hook = await mount();
    await activarSinDialogos(hook);
    await act(async () => hook.result.current.deactivate());
    expect(hook.result.current.state).toBe('idle');
    expect(hook.result.current.freshlyActivated).toBe(false);
  });
});

describe('onboarding del modo', () => {
  it('se abre solo la primera vez que se activa', async () => {
    const hook = await mount();
    await activar(hook);
    expect(hook.result.current.onboardingVisible).toBe(true);
  });

  it('no se repite si ya se vio', async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    const hook = await mount();
    await activar(hook);
    expect(hook.result.current.onboardingVisible).toBe(false);
  });

  it('dismissOnboarding lo marca como visto', async () => {
    const hook = await mount();
    await activar(hook);
    await act(async () => hook.result.current.dismissOnboarding());
    expect(hook.result.current.onboardingVisible).toBe(false);
    expect(await AsyncStorage.getItem(ONBOARDING_KEY)).toBe('1');
  });

  it('openOnboarding lo vuelve a abrir (badge)', async () => {
    const hook = await mount();
    await act(async () => hook.result.current.openOnboarding());
    expect(hook.result.current.onboardingVisible).toBe(true);
  });
});

describe('restauración al reabrir la app', () => {
  it('recupera el modo activo sin celebrar ni contar', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, '1');
    const { result } = await mount();
    expect(result.current.state).toBe('active');
    expect(result.current.freshlyActivated).toBe(false);
    expect(setCarismochitoTheme).toHaveBeenCalledWith(true);
    expect(syncAppIcon).toHaveBeenCalledWith(true);
  });

  it('si no quedó activo, resincroniza el icono a apagado', async () => {
    const { result } = await mount();
    expect(result.current.state).toBe('idle');
    expect(syncAppIcon).toHaveBeenCalledWith(false);
  });
});

describe('useCarismochito fuera del provider', () => {
  it('lanza un error explícito', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderHook(() => useCarismochito())).rejects.toThrow(
      /dentro de CarismochitoProvider/,
    );
    spy.mockRestore();
  });
});

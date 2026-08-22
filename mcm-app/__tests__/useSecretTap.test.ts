/**
 * Tests de `hooks/useSecretTap.ts`.
 *
 * Cuenta taps consecutivos para desbloquear un modo secreto (Carismochito).
 * Si la ventana de tiempo o el contador fallan, o bien nunca se dispara el
 * unlock, o se dispara con menos taps de los que debería (frustrante o, peor,
 * un "easter egg" que salta por accidente).
 */
import { renderHook, act } from '@testing-library/react-native';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSecretTap } from '@/hooks/useSecretTap';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success' },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  Platform.OS = 'ios';
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useSecretTap', () => {
  it('dispara onUnlock al llegar a tapsRequired (7 por defecto)', async () => {
    const onUnlock = jest.fn();
    const { result } = await renderHook(() => useSecretTap(onUnlock));

    await act(async () => {
      for (let i = 0; i < 6; i++) result.current.onPress();
    });
    expect(onUnlock).not.toHaveBeenCalled();

    await act(async () => result.current.onPress());
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  it('respeta un tapsRequired custom', async () => {
    const onUnlock = jest.fn();
    const { result } = await renderHook(() =>
      useSecretTap(onUnlock, { tapsRequired: 3 }),
    );
    await act(async () => {
      result.current.onPress();
      result.current.onPress();
    });
    expect(onUnlock).not.toHaveBeenCalled();
    await act(async () => result.current.onPress());
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  it('resetea el contador si el usuario tarda demasiado entre taps', async () => {
    const onUnlock = jest.fn();
    const { result } = await renderHook(() =>
      useSecretTap(onUnlock, { tapsRequired: 3, resetAfterMs: 500 }),
    );
    await act(async () => result.current.onPress());
    await act(async () => jest.advanceTimersByTime(600));
    await act(async () => result.current.onPress());
    await act(async () => result.current.onPress());
    // Solo 2 taps "vigentes" (el primero expiró) — no debería desbloquear.
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it('reset() manual reinicia el contador', async () => {
    const onUnlock = jest.fn();
    const { result } = await renderHook(() =>
      useSecretTap(onUnlock, { tapsRequired: 3 }),
    );
    await act(async () => {
      result.current.onPress();
      result.current.onPress();
      result.current.reset();
    });
    await act(async () => {
      result.current.onPress();
      result.current.onPress();
    });
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it('emite haptics de impacto a partir del 4º tap y de éxito al desbloquear', async () => {
    const onUnlock = jest.fn();
    const { result } = await renderHook(() =>
      useSecretTap(onUnlock, { tapsRequired: 5 }),
    );
    await act(async () => {
      for (let i = 0; i < 5; i++) result.current.onPress();
    });
    expect(Haptics.impactAsync).toHaveBeenCalled();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  });

  it('no emite haptics si haptics: false', async () => {
    const onUnlock = jest.fn();
    const { result } = await renderHook(() =>
      useSecretTap(onUnlock, { tapsRequired: 5, haptics: false }),
    );
    await act(async () => {
      for (let i = 0; i < 5; i++) result.current.onPress();
    });
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it('no emite haptics en web', async () => {
    Platform.OS = 'web';
    const onUnlock = jest.fn();
    const { result } = await renderHook(() =>
      useSecretTap(onUnlock, { tapsRequired: 5 }),
    );
    await act(async () => {
      for (let i = 0; i < 5; i++) result.current.onPress();
    });
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });
});

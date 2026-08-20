/**
 * Tests de `useScreenTracking`: engancha la analítica UNA vez en el layout
 * raíz en vez de en cada una de las ~20 pantallas (que envejece fatal:
 * alguien añade una pantalla y se olvida la llamada). Lo importante:
 *
 *  - Nada se manda hasta que el perfil ha cargado (si no, los primeros
 *    eventos de cada sesión saldrían siempre como "sin_perfil").
 *  - `app_abierta` + `initAnalytics` se disparan UNA sola vez por sesión.
 *  - `pantalla_vista` no se duplica si `usePathname` repite el mismo valor
 *    (cambio de params, remontaje).
 */
import { renderHook } from '@testing-library/react-native';
import { usePathname } from 'expo-router';
import { useUserProfile } from '@/contexts/UserProfileContext';
import {
  initAnalytics,
  setAnalyticsProfile,
  trackEvent,
} from '@/utils/analytics';
import { useScreenTracking } from '@/hooks/useScreenTracking';

jest.mock('expo-router', () => ({
  usePathname: jest.fn(),
}));
jest.mock('@/contexts/UserProfileContext', () => ({
  useUserProfile: jest.fn(),
}));
jest.mock('@/utils/analytics', () => ({
  initAnalytics: jest.fn(),
  setAnalyticsProfile: jest.fn(),
  trackEvent: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  (usePathname as jest.Mock).mockReturnValue('/cancionero');
});

describe('mientras el perfil sigue cargando', () => {
  it('no manda nada en absoluto', async () => {
    (useUserProfile as jest.Mock).mockReturnValue({
      profile: { profileType: null, delegationId: null },
      loading: true,
    });
    await renderHook(() => useScreenTracking());
    expect(setAnalyticsProfile).not.toHaveBeenCalled();
    expect(initAnalytics).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });
});

describe('cuando el perfil ya está listo', () => {
  it('fija el perfil de analítica, arranca y manda app_abierta + la pantalla actual', async () => {
    (useUserProfile as jest.Mock).mockReturnValue({
      profile: { profileType: 'monitor', delegationId: 'madrid' },
      loading: false,
    });
    await renderHook(() => useScreenTracking());
    expect(setAnalyticsProfile).toHaveBeenCalledWith({
      perfil: 'monitor',
      delegacion: 'madrid',
    });
    expect(initAnalytics).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('app_abierta');
    expect(trackEvent).toHaveBeenCalledWith('pantalla_vista', {
      ruta: '/cancionero',
    });
  });

  it('sin profileType/delegationId, usa los fallbacks', async () => {
    (useUserProfile as jest.Mock).mockReturnValue({
      profile: { profileType: null, delegationId: null },
      loading: false,
    });
    await renderHook(() => useScreenTracking());
    expect(setAnalyticsProfile).toHaveBeenCalledWith({
      perfil: 'sin_perfil',
      delegacion: 'sin_delegacion',
    });
  });

  it('no repite app_abierta/initAnalytics si se remonta el efecto (bootstrap único)', async () => {
    (useUserProfile as jest.Mock).mockReturnValue({
      profile: { profileType: 'monitor', delegationId: 'madrid' },
      loading: false,
    });
    const { rerender } = await renderHook(() => useScreenTracking());
    await rerender({});
    await rerender({});
    expect(initAnalytics).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('app_abierta');
    expect(
      (trackEvent as jest.Mock).mock.calls.filter((c) => c[0] === 'app_abierta'),
    ).toHaveLength(1);
  });

  it('no duplica pantalla_vista si la ruta no cambia entre renders', async () => {
    (useUserProfile as jest.Mock).mockReturnValue({
      profile: { profileType: 'monitor', delegationId: 'madrid' },
      loading: false,
    });
    const { rerender } = await renderHook(() => useScreenTracking());
    await rerender({});
    const vistaCalls = (trackEvent as jest.Mock).mock.calls.filter(
      (c) => c[0] === 'pantalla_vista',
    );
    expect(vistaCalls).toHaveLength(1);
  });

  it('manda una nueva pantalla_vista cuando cambia la ruta', async () => {
    (useUserProfile as jest.Mock).mockReturnValue({
      profile: { profileType: 'monitor', delegationId: 'madrid' },
      loading: false,
    });
    const { rerender } = await renderHook(() => useScreenTracking());
    (usePathname as jest.Mock).mockReturnValue('/contigo');
    await rerender({});
    expect(trackEvent).toHaveBeenCalledWith('pantalla_vista', {
      ruta: '/contigo',
    });
  });

  it('vuelve a fijar el perfil de analítica si cambia el perfil del usuario', async () => {
    (useUserProfile as jest.Mock).mockReturnValue({
      profile: { profileType: 'monitor', delegationId: 'madrid' },
      loading: false,
    });
    const { rerender } = await renderHook(() => useScreenTracking());
    (useUserProfile as jest.Mock).mockReturnValue({
      profile: { profileType: 'familia', delegationId: 'sevilla' },
      loading: false,
    });
    await rerender({});
    expect(setAnalyticsProfile).toHaveBeenLastCalledWith({
      perfil: 'familia',
      delegacion: 'sevilla',
    });
  });
});

/**
 * Test de `hooks/useResolvedProfileConfig.ts`.
 *
 * Rompe el ciclo entre `ProfileConfigContext` (config remota) y
 * `UserProfileContext` (perfil elegido en el onboarding) llamando al
 * resolver puro (`resolveProfileConfig`, ya testeado a fondo). Lo único que
 * importa aquí es el fallback: sin perfil completado, se resuelve como
 * `miembro` + `_default`, igual que si el usuario hubiera saltado el
 * onboarding.
 */
import { renderHook } from '@testing-library/react-native';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import { DEFAULT_PROFILE_TYPE } from '@/constants/defaultProfileConfig';

let mockRawConfig: unknown = { profiles: {} };
let mockProfile: { profileType?: string | null; delegationId?: string | null } =
  {};

jest.mock('@/contexts/ProfileConfigContext', () => ({
  useProfileConfigContext: () => ({ rawConfig: mockRawConfig }),
}));

jest.mock('@/contexts/UserProfileContext', () => ({
  useUserProfile: () => ({ profile: mockProfile }),
}));

const mockResolve = jest.fn((...args: unknown[]) => {
  const [rawConfig, profileType, delegationId] = args;
  return { rawConfig, profileType, delegationId };
});

jest.mock('@/utils/resolveProfileConfig', () => ({
  resolveProfileConfig: (...args: unknown[]) => mockResolve(...args),
}));

beforeEach(() => {
  mockRawConfig = { profiles: {} };
  mockProfile = {};
  mockResolve.mockClear();
});

describe('useResolvedProfileConfig', () => {
  it('usa el profileType y delegationId del perfil del usuario', async () => {
    mockProfile = { profileType: 'joven', delegationId: 'castellon' };
    const { result } = await renderHook(() => useResolvedProfileConfig());
    expect(result.current).toEqual({
      rawConfig: mockRawConfig,
      profileType: 'joven',
      delegationId: 'castellon',
    });
  });

  it('sin profileType (onboarding sin completar), cae a DEFAULT_PROFILE_TYPE', async () => {
    mockProfile = { profileType: null, delegationId: null };
    const { result } = await renderHook(() => useResolvedProfileConfig());
    expect(result.current.profileType).toBe(DEFAULT_PROFILE_TYPE);
  });

  it('memoiza: no vuelve a resolver si nada cambia entre renders', async () => {
    mockProfile = { profileType: 'joven', delegationId: 'castellon' };
    const { rerender } = await renderHook(() => useResolvedProfileConfig());
    expect(mockResolve).toHaveBeenCalledTimes(1);
    await rerender(undefined);
    expect(mockResolve).toHaveBeenCalledTimes(1);
  });
});

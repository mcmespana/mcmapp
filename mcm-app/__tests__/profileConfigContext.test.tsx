/**
 * Tests de `ProfileConfigContext`: la config remota de perfiles
 * (`/profileConfig`) que decide qué tabs/botones/calendarios ve cada
 * usuario. Dos reglas críticas:
 *
 *  - Si el documento remoto llega corrupto o a medias (sin `profiles`, sin
 *    `delegations`...), hay que caer al fallback hardcoded en vez de dejar
 *    que un resolver más abajo reviente con datos a medio construir.
 *  - `delegationList` NUNCA se lee de Firebase: siempre se deriva de
 *    `delegations` (excluyendo la pseudo-delegación `_default`), para que no
 *    puedan desincronizarse dos fuentes de la misma lista.
 *
 * `useFirebaseData` va mockeado: aquí se testea solo lo que
 * `ProfileConfigContext` añade encima (validación + derivación), no la
 * mecánica de caché/red que ya cubre `useFirebaseData.test.ts`.
 */
import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import {
  ProfileConfigProvider,
  useProfileConfigContext,
} from '@/contexts/ProfileConfigContext';
import { DEFAULT_PROFILE_CONFIG_DATA } from '@/constants/defaultProfileConfig';

jest.mock('@/hooks/useFirebaseData', () => ({
  useFirebaseData: jest.fn(),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ProfileConfigProvider>{children}</ProfileConfigProvider>
);

async function mount() {
  return renderHook(() => useProfileConfigContext(), { wrapper });
}

const validConfig = {
  global: { defaultTab: 'index' },
  profiles: {
    miembro: { label: 'Miembro', tabs: ['index'] },
  },
  delegations: {
    _default: { label: 'General' },
    madrid: { label: 'Madrid' },
    sevilla: { label: 'Sevilla' },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('config remota válida', () => {
  it('usa los datos remotos y deriva delegationList sin `_default`', async () => {
    (useFirebaseData as jest.Mock).mockReturnValue({
      data: validConfig,
      loading: false,
      offline: false,
    });
    const { result } = await mount();
    expect(result.current.rawConfig.profiles).toBe(validConfig.profiles);
    expect(result.current.rawConfig.delegationList).toEqual([
      { id: 'madrid', label: 'Madrid' },
      { id: 'sevilla', label: 'Sevilla' },
    ]);
  });

  it('conserva el orden de inserción de las delegaciones', async () => {
    (useFirebaseData as jest.Mock).mockReturnValue({
      data: {
        ...validConfig,
        delegations: {
          zaragoza: { label: 'Zaragoza' },
          _default: { label: 'General' },
          alicante: { label: 'Alicante' },
        },
      },
      loading: false,
      offline: false,
    });
    const { result } = await mount();
    expect(result.current.rawConfig.delegationList).toEqual([
      { id: 'zaragoza', label: 'Zaragoza' },
      { id: 'alicante', label: 'Alicante' },
    ]);
  });

  it('pasa loading y offline tal cual vienen del hook', async () => {
    (useFirebaseData as jest.Mock).mockReturnValue({
      data: validConfig,
      loading: true,
      offline: true,
    });
    const { result } = await mount();
    expect(result.current.loading).toBe(true);
    expect(result.current.offline).toBe(true);
  });
});

describe('config remota inválida o ausente', () => {
  it('cae al fallback si no hay datos todavía (null)', async () => {
    (useFirebaseData as jest.Mock).mockReturnValue({
      data: null,
      loading: true,
      offline: false,
    });
    const { result } = await mount();
    expect(result.current.rawConfig.profiles).toBe(
      DEFAULT_PROFILE_CONFIG_DATA.profiles,
    );
  });

  it('cae al fallback si falta `profiles`', async () => {
    (useFirebaseData as jest.Mock).mockReturnValue({
      data: { global: {}, delegations: {} },
      loading: false,
      offline: false,
    });
    const { result } = await mount();
    expect(result.current.rawConfig).toMatchObject({
      profiles: DEFAULT_PROFILE_CONFIG_DATA.profiles,
    });
  });

  it('cae al fallback si `profiles` está vacío (sin ni un perfil base)', async () => {
    (useFirebaseData as jest.Mock).mockReturnValue({
      data: { ...validConfig, profiles: {} },
      loading: false,
      offline: false,
    });
    const { result } = await mount();
    expect(result.current.rawConfig.profiles).toBe(
      DEFAULT_PROFILE_CONFIG_DATA.profiles,
    );
  });

  it('cae al fallback si falta `delegations`', async () => {
    const { delegations: _omit, ...rest } = validConfig;
    (useFirebaseData as jest.Mock).mockReturnValue({
      data: rest,
      loading: false,
      offline: false,
    });
    const { result } = await mount();
    expect(result.current.rawConfig.profiles).toBe(
      DEFAULT_PROFILE_CONFIG_DATA.profiles,
    );
  });

  it('el fallback también deriva su delegationList (sin `_default`)', async () => {
    (useFirebaseData as jest.Mock).mockReturnValue({
      data: null,
      loading: false,
      offline: false,
    });
    const { result } = await mount();
    expect(
      result.current.rawConfig.delegationList.some((d) => d.id === '_default'),
    ).toBe(false);
    expect(result.current.rawConfig.delegationList.length).toBeGreaterThan(0);
  });
});

describe('fuera del provider', () => {
  it('devuelve el fallback por defecto (createContext con default real)', async () => {
    const { result } = await renderHook(() => useProfileConfigContext());
    expect(result.current.loading).toBe(false);
    expect(result.current.offline).toBe(false);
    expect(result.current.rawConfig.profiles).toBe(
      DEFAULT_PROFILE_CONFIG_DATA.profiles,
    );
  });
});

/**
 * Tests de los tres contextos de ajustes persistidos en AsyncStorage:
 * `SettingsContext` (cantoral), `AppSettingsContext` (fuente y tema) y
 * `UserProfileContext` (perfil/onboarding).
 *
 * Los tres comparten el mismo patrón —cargar → fusionar con defaults →
 * guardar en cada cambio— y el mismo par de fallos posibles: escribir antes
 * de haber cargado (que borra los ajustes del usuario al arrancar) y no
 * fusionar con los defaults (que deja `undefined` en claves nuevas cuando el
 * JSON guardado es de una versión anterior de la app).
 */
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, Platform } from 'react-native';
import {
  SettingsProvider,
  useSettings,
  DEFAULT_FONT_SIZE_EM,
} from '@/contexts/SettingsContext';
import {
  AppSettingsProvider,
  useAppSettings,
} from '@/contexts/AppSettingsContext';
import {
  UserProfileProvider,
  useUserProfile,
} from '@/contexts/UserProfileContext';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('SettingsContext (ajustes del cantoral)', () => {
  const KEY = '@mcm_song_settings';
  const ADMIN_KEY = '@mcm_is_admin';

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SettingsProvider>{children}</SettingsProvider>
  );

  async function mount() {
    const hook = await renderHook(() => useSettings(), { wrapper });
    await waitFor(() =>
      expect(hook.result.current.isLoadingSettings).toBe(false),
    );
    return hook;
  }

  it('arranca con los defaults', async () => {
    const { result } = await mount();
    expect(result.current.settings).toEqual({
      chordsVisible: true,
      fontSize: DEFAULT_FONT_SIZE_EM,
      fontFamily: "'Roboto Mono', 'Courier New', monospace",
      notation: 'ES',
    });
    expect(result.current.isAdmin).toBe(false);
  });

  it('fusiona lo guardado con los defaults (claves nuevas no quedan undefined)', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ notation: 'EN' }));
    const { result } = await mount();
    expect(result.current.settings.notation).toBe('EN');
    expect(result.current.settings.chordsVisible).toBe(true);
    expect(result.current.settings.fontSize).toBe(DEFAULT_FONT_SIZE_EM);
  });

  it('un fontSize de 0 guardado cae al default (0 no es un tamaño válido)', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ fontSize: 0 }));
    const { result } = await mount();
    expect(result.current.settings.fontSize).toBe(DEFAULT_FONT_SIZE_EM);
  });

  it('vuelve a los defaults si el JSON está corrupto', async () => {
    await AsyncStorage.setItem(KEY, 'no-json');
    const { result } = await mount();
    expect(result.current.settings.notation).toBe('ES');
  });

  it('setSettings aplica cambios parciales y persiste', async () => {
    const { result } = await mount();
    await act(async () => result.current.setSettings({ chordsVisible: false }));
    expect(result.current.settings.chordsVisible).toBe(false);
    expect(result.current.settings.notation).toBe('ES');
    await waitFor(async () => {
      const raw = await AsyncStorage.getItem(KEY);
      expect(JSON.parse(raw!).chordsVisible).toBe(false);
    });
  });

  it('recupera el modo admin persistido', async () => {
    await AsyncStorage.setItem(ADMIN_KEY, 'true');
    const { result } = await mount();
    expect(result.current.isAdmin).toBe(true);
  });

  it('setIsAdmin persiste como cadena "true"/"false"', async () => {
    const { result } = await mount();
    await act(async () => result.current.setIsAdmin(true));
    expect(result.current.isAdmin).toBe(true);
    await waitFor(async () =>
      expect(await AsyncStorage.getItem(ADMIN_KEY)).toBe('true'),
    );
    await act(async () => result.current.setIsAdmin(false));
    await waitFor(async () =>
      expect(await AsyncStorage.getItem(ADMIN_KEY)).toBe('false'),
    );
  });

  it('fuera del provider devuelve defaults en vez de reventar (SSG)', async () => {
    const { result } = await renderHook(() => useSettings());
    expect(result.current.isLoadingSettings).toBe(true);
    expect(result.current.settings.notation).toBe('ES');
    expect(() => result.current.setSettings({ notation: 'EN' })).not.toThrow();
  });
});

describe('AppSettingsContext (fuente y tema)', () => {
  const KEY = '@app_settings';

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AppSettingsProvider>{children}</AppSettingsProvider>
  );

  async function mount() {
    const hook = await renderHook(() => useAppSettings(), { wrapper });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    return hook;
  }

  it('arranca con escala 1 y tema del sistema', async () => {
    const { result } = await mount();
    expect(result.current.settings).toEqual({
      fontScale: 1,
      theme: 'system',
      sectionFontScales: {},
    });
  });

  it('recupera lo guardado fusionando con los defaults', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ fontScale: 1.4 }));
    const { result } = await mount();
    expect(result.current.settings.fontScale).toBe(1.4);
    expect(result.current.settings.theme).toBe('system');
  });

  it('guarda los overrides de sección', async () => {
    const { result } = await mount();
    await act(async () =>
      result.current.setSettings({ sectionFontScales: { contigo: 1.6 } }),
    );
    await waitFor(async () => {
      const raw = await AsyncStorage.getItem(KEY);
      expect(JSON.parse(raw!).sectionFontScales).toEqual({ contigo: 1.6 });
    });
  });

  it('alinea la apariencia nativa con el tema elegido', async () => {
    const spy = jest
      .spyOn(Appearance, 'setColorScheme')
      .mockImplementation(() => {});
    const { result } = await mount();
    // Al terminar la carga ya se aplica el tema guardado ('system').
    expect(spy).toHaveBeenLastCalledWith('unspecified');
    await act(async () => result.current.setSettings({ theme: 'dark' }));
    expect(spy).toHaveBeenLastCalledWith('dark');
    spy.mockRestore();
  });

  it('en web no toca la apariencia nativa', async () => {
    const spy = jest
      .spyOn(Appearance, 'setColorScheme')
      .mockImplementation(() => {});
    const real = Platform.OS;
    Object.defineProperty(Platform, 'OS', {
      get: () => 'web',
      configurable: true,
    });
    await mount();
    expect(spy).not.toHaveBeenCalled();
    Object.defineProperty(Platform, 'OS', {
      get: () => real,
      configurable: true,
    });
    spy.mockRestore();
  });

  it('fuera del provider devuelve defaults (SSG)', async () => {
    const { result } = await renderHook(() => useAppSettings());
    expect(result.current.loading).toBe(true);
    expect(result.current.settings.fontScale).toBe(1);
  });
});

describe('UserProfileContext', () => {
  const KEY = '@user_profile';

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <UserProfileProvider>{children}</UserProfileProvider>
  );

  async function mount() {
    const hook = await renderHook(() => useUserProfile(), { wrapper });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    return hook;
  }

  it('arranca sin perfil y sin onboarding completado', async () => {
    const { result } = await mount();
    expect(result.current.profile).toEqual({
      name: '',
      profileType: null,
      delegationId: null,
      onboardingCompleted: false,
    });
  });

  it('recupera el perfil guardado', async () => {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({
        name: 'Ana',
        profileType: 'joven',
        delegationId: 'madrid',
        onboardingCompleted: true,
      }),
    );
    const { result } = await mount();
    expect(result.current.profile.name).toBe('Ana');
    expect(result.current.profile.profileType).toBe('joven');
    expect(result.current.profile.delegationId).toBe('madrid');
    expect(result.current.profile.onboardingCompleted).toBe(true);
  });

  it('normaliza las claves ausentes del JSON guardado', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ name: 'Ana' }));
    const { result } = await mount();
    expect(result.current.profile.profileType).toBeNull();
    expect(result.current.profile.delegationId).toBeNull();
    expect(result.current.profile.onboardingCompleted).toBe(false);
  });

  it('onboardingCompleted solo es true con el booleano exacto', async () => {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ onboardingCompleted: 'true' }),
    );
    const { result } = await mount();
    expect(result.current.profile.onboardingCompleted).toBe(false);
  });

  it('no revienta con JSON corrupto', async () => {
    await AsyncStorage.setItem(KEY, '{{{');
    const { result } = await mount();
    expect(result.current.profile.name).toBe('');
  });

  it('setProfile fusiona y persiste', async () => {
    const { result } = await mount();
    await act(async () => result.current.setProfile({ name: 'Luis' }));
    await act(async () =>
      result.current.setProfile({ onboardingCompleted: true }),
    );
    expect(result.current.profile.name).toBe('Luis');
    await waitFor(async () => {
      const raw = await AsyncStorage.getItem(KEY);
      expect(JSON.parse(raw!)).toMatchObject({
        name: 'Luis',
        onboardingCompleted: true,
      });
    });
  });

  it('fuera del provider devuelve defaults (SSG)', async () => {
    const { result } = await renderHook(() => useUserProfile());
    expect(result.current.loading).toBe(true);
    expect(result.current.profile.onboardingCompleted).toBe(false);
  });
});

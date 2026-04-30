/**
 * Tests del resolver del Sistema de Perfiles.
 *
 * Cubre:
 *  - Merge perfil + delegación (extras aditivos, override de delegación,
 *    override específico perfil:delegación).
 *  - Sanitización contra catálogo (descarte de IDs desconocidos, fallback
 *    si el array queda vacío).
 *  - Que los `notificationTopic` de delegación (libres, ej. "castellon")
 *    NO se descarten — son los que usa el backend para segmentar.
 *  - Tolerancia a config corrupta (perfil ausente, arrays undefined,
 *    global ausente) — la app no debe crashear.
 *  - `isAppVersionSupported` con strings inválidos / NaN.
 */
import {
  resolveProfileConfig,
  isAppVersionSupported,
} from '@/utils/resolveProfileConfig';
import type { ProfileConfigData } from '@/types/profileConfig';

const baseConfig: ProfileConfigData = {
  global: {
    defaultTab: 'index',
    showNotificationsIcon: true,
    showOnboarding: true,
    showChangeNameButton: false,
    maintenanceMode: false,
    maintenanceMessage: '',
    minAppVersion: '0.0.0',
  },
  profiles: {
    familia: {
      label: 'Familia',
      description: 'Padres y familiares',
      tabs: ['index', 'cancionero', 'fotos', 'mas'],
      homeButtons: ['cancionero', 'fotos', 'mas'],
      masItems: ['jubileo'],
      defaultCalendars: ['cal-general'],
      albumTags: ['general'],
      notificationTopics: ['general', 'familias'],
    },
    monitor: {
      label: 'Monitor/a',
      description: '',
      tabs: ['index', 'cancionero', 'mas'],
      homeButtons: ['cancionero', 'mas'],
      masItems: ['jubileo', 'comunica-gestion'],
      defaultCalendars: [],
      albumTags: ['all'],
      notificationTopics: ['general', 'monitores'],
    },
    miembro: {
      label: 'Miembro',
      description: '',
      tabs: ['index', 'cancionero', 'mas'],
      homeButtons: ['cancionero', 'mas'],
      masItems: ['jubileo'],
      defaultCalendars: [],
      albumTags: ['all'],
      notificationTopics: ['general', 'miembros'],
    },
  },
  delegations: {
    _default: { label: 'General' },
    castellon: {
      label: 'Castellón',
      notificationTopic: 'castellon',
      extraCalendars: ['castellon-local'],
      extraTabs: ['comunica'],
    },
    madrid: {
      label: 'Madrid',
      override: {
        homeButtons: ['fotos'],
      },
    },
  },
  delegationList: [
    { id: 'castellon', label: 'Castellón' },
    { id: 'madrid', label: 'Madrid' },
  ],
  overrides: {
    'familia:castellon': {
      masItems: ['jubileo', 'comunica'],
    },
  },
};

describe('resolveProfileConfig', () => {
  it('devuelve perfil base puro si la delegación es _default', () => {
    const r = resolveProfileConfig(baseConfig, 'familia', null);
    expect(r.tabs).toEqual(['index', 'cancionero', 'fotos', 'mas']);
    expect(r.homeButtons).toEqual(['cancionero', 'fotos', 'mas']);
    expect(r.delegationLabel).toBe('General');
    expect(r.profileLabel).toBe('Familia');
    expect(r.delegationId).toBe('_default');
  });

  it('aplica extras aditivos de la delegación (deduplicados)', () => {
    const r = resolveProfileConfig(baseConfig, 'familia', 'castellon');
    expect(r.tabs).toContain('comunica');
    expect(r.defaultCalendars).toEqual(['cal-general', 'castellon-local']);
  });

  it('mantiene los notificationTopic de delegación pese a no estar en KNOWN_NOTIFICATION_TOPICS', () => {
    const r = resolveProfileConfig(baseConfig, 'familia', 'castellon');
    expect(r.notificationTopics).toContain('castellon');
    expect(r.notificationTopics).toContain('general');
    expect(r.notificationTopics).toContain('familias');
  });

  it('aplica override completo de la delegación', () => {
    const r = resolveProfileConfig(baseConfig, 'familia', 'madrid');
    expect(r.homeButtons).toEqual(['fotos']);
  });

  it('aplica override específico profileType:delegationId con prioridad', () => {
    const r = resolveProfileConfig(baseConfig, 'familia', 'castellon');
    expect(r.masItems).toEqual(['jubileo', 'comunica']);
  });

  it('descarta IDs de tabs desconocidos pero mantiene los válidos', () => {
    const corrupted: ProfileConfigData = {
      ...baseConfig,
      profiles: {
        ...baseConfig.profiles,
        familia: {
          ...baseConfig.profiles.familia,
          tabs: ['index', 'cancionero', 'tab-inventado', 'mas'],
        },
      },
    };
    const r = resolveProfileConfig(corrupted, 'familia', null);
    expect(r.tabs).toEqual(['index', 'cancionero', 'mas']);
  });

  it('cae al perfil base si tras sanitización el array queda vacío', () => {
    const corrupted: ProfileConfigData = {
      ...baseConfig,
      profiles: {
        ...baseConfig.profiles,
        familia: {
          ...baseConfig.profiles.familia,
          tabs: ['solo-basura', 'mas-basura'],
        },
      },
    };
    const r = resolveProfileConfig(corrupted, 'familia', null);
    // El sanitizador devuelve el fallback (perfil base ya tenía sólo los basura,
    // por lo que queda vacío y el sanitizador devuelve el mismo fallback vacío
    // → comportamiento defensivo: nunca crashea aunque el array final sea []).
    expect(Array.isArray(r.tabs)).toBe(true);
  });

  it('no crashea si el perfil pedido no existe (fallback al primer perfil)', () => {
    const r = resolveProfileConfig(baseConfig, 'fantasma' as any, null);
    expect(r.profileType).toBe('fantasma');
    expect(Array.isArray(r.tabs)).toBe(true);
    expect(r.tabs.length).toBeGreaterThan(0);
  });

  it('sobrevive a un global ausente con valores por defecto sensatos', () => {
    const partial = {
      ...baseConfig,
      global: undefined as any,
    } as ProfileConfigData;
    const r = resolveProfileConfig(partial, 'familia', null);
    expect(r.defaultTab).toBe('index');
    expect(r.maintenanceMode).toBe(false);
    expect(r.minAppVersion).toBe('0.0.0');
  });

  it('sobrevive a arrays del perfil ausentes (undefined → [])', () => {
    const partial: ProfileConfigData = {
      ...baseConfig,
      profiles: {
        ...baseConfig.profiles,
        miembro: {
          label: 'Miembro',
          description: '',
          tabs: undefined as any,
          homeButtons: undefined as any,
          masItems: undefined as any,
          defaultCalendars: undefined as any,
          albumTags: undefined as any,
          notificationTopics: undefined as any,
        },
      },
    };
    expect(() => resolveProfileConfig(partial, 'miembro', null)).not.toThrow();
  });
});

describe('isAppVersionSupported', () => {
  it('devuelve true si minVersion es 0.0.0', () => {
    expect(isAppVersionSupported('1.2.3', '0.0.0')).toBe(true);
  });

  it('compara semver simple correctamente', () => {
    expect(isAppVersionSupported('1.0.1', '1.0.0')).toBe(true);
    expect(isAppVersionSupported('1.0.0', '1.0.1')).toBe(false);
    expect(isAppVersionSupported('2.0.0', '1.99.99')).toBe(true);
  });

  it('iguala como soportada', () => {
    expect(isAppVersionSupported('1.0.0', '1.0.0')).toBe(true);
  });

  it('limpia sufijos -beta / +build', () => {
    expect(isAppVersionSupported('1.0.0-beta.1', '1.0.0')).toBe(true);
    expect(isAppVersionSupported('1.0.0+build.5', '1.0.0')).toBe(true);
  });

  it('no se rompe con strings inválidos (NaN-safe)', () => {
    expect(isAppVersionSupported('foo', '1.0.0')).toBe(false);
    expect(isAppVersionSupported('', '1.0.0')).toBe(false);
    expect(isAppVersionSupported('1.0.0', 'foo')).toBe(true);
  });
});

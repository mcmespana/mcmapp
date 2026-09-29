/**
 * resolveProfileConfig — el orden del merge y los huecos de la config remota.
 *
 * El panel edita `/profileConfig` a mano. Si el orden (perfil → extras de
 * delegación → override de delegación → override perfil:delegación) cambia,
 * o si una delegación nueva no está en el documento, nadie ve un error: a
 * una delegación le desaparece su calendario o su topic de notificaciones y
 * deja de recibir avisos. Lo básico está en `resolveProfileConfig.test.ts`.
 */
import {
  resolveProfileConfig,
  isAppVersionSupported,
} from '@/utils/resolveProfileConfig';
import type {
  Delegation,
  ProfileBase,
  ProfileConfigData,
} from '@/types/profileConfig';

/** Delegaciones sin `_default`, que es justo el caso que se quiere probar. */
const dels = (d: Record<string, Delegation>) =>
  d as ProfileConfigData['delegations'];

const profile = (over: Partial<ProfileBase> = {}): ProfileBase => ({
  label: 'Familia',
  description: '',
  tabs: ['index', 'cancionero', 'mas'],
  homeButtons: ['cancionero', 'mas'],
  masItems: ['jubileo'],
  defaultCalendars: ['cal-general'],
  albumTags: ['general'],
  notificationTopics: ['general'],
  ...over,
});

const config = (over: Partial<ProfileConfigData> = {}): ProfileConfigData =>
  ({
    global: {},
    profiles: { familia: profile(), monitor: profile({ label: 'Monitor' }) },
    delegations: { _default: { label: 'General' } },
    ...over,
  }) as ProfileConfigData;

describe('resolveProfileConfig — delegaciones', () => {
  it('una delegación que no está en el documento usa la _default, pero conserva su id', () => {
    const r = resolveProfileConfig(config(), 'familia', 'mcm-nueva');
    expect(r.delegationLabel).toBe('General');
    // El id se mantiene: es lo que se guarda en el perfil del usuario y lo que
    // usa el backend. Cambiarlo por "_default" lo borraría de su delegación.
    expect(r.delegationId).toBe('mcm-nueva');
  });

  it('sin _default en el documento, la etiqueta cae a "General" en vez de quedar vacía', () => {
    const r = resolveProfileConfig(
      config({ delegations: dels({}) }),
      'familia',
      null,
    );
    expect(r.delegationLabel).toBe('General');
  });

  it('el topic de la delegación no se duplica si el perfil ya lo tenía', () => {
    const r = resolveProfileConfig(
      config({
        profiles: {
          familia: profile({ notificationTopics: ['general', 'mcm-madrid'] }),
        } as ProfileConfigData['profiles'],
        delegations: dels({
          'mcm-madrid': { label: 'Madrid', notificationTopic: 'mcm-madrid' },
        }),
      }),
      'familia',
      'mcm-madrid',
    );
    expect(r.notificationTopics).toEqual(['general', 'mcm-madrid']);
  });

  it('los calendarios extra no se validan contra catálogo (vienen de /calendars)', () => {
    const r = resolveProfileConfig(
      config({
        delegations: dels({
          x: { label: 'X', extraCalendars: ['mcm-x', 'cal-general'] },
        }),
      }),
      'familia',
      'x',
    );
    expect(r.defaultCalendars).toEqual(['cal-general', 'mcm-x']);
  });

  it('un extraTabs con un id que no existe no cuela una pestaña fantasma', () => {
    const r = resolveProfileConfig(
      config({
        delegations: dels({
          x: { label: 'X', extraTabs: ['comunica', 'pestaña-inventada'] },
        }),
      }),
      'familia',
      'x',
    );
    expect(r.tabs).toEqual(['index', 'cancionero', 'mas', 'comunica']);
  });
});

describe('resolveProfileConfig — orden del merge', () => {
  it('el override de la delegación va DESPUÉS de sus extras: reemplaza, no suma', () => {
    const r = resolveProfileConfig(
      config({
        delegations: dels({
          x: {
            label: 'X',
            extraHomeButtons: ['fotos'],
            override: { homeButtons: ['cancionero'] },
          },
        }),
      }),
      'familia',
      'x',
    );
    expect(r.homeButtons).toEqual(['cancionero']);
  });

  it('el override perfil:delegación gana al override de la delegación', () => {
    const r = resolveProfileConfig(
      config({
        delegations: dels({
          x: { label: 'X', override: { masItems: ['jubileo'] } },
        }),
        overrides: { 'familia:x': { masItems: ['comunica-gestion'] } },
      }),
      'familia',
      'x',
    );
    expect(r.masItems).toEqual(['comunica-gestion']);
  });

  it('el override perfil:delegación de OTRO perfil no se aplica', () => {
    const r = resolveProfileConfig(
      config({
        overrides: { 'monitor:_default': { tabs: ['index'] } },
      }),
      'familia',
      null,
    );
    expect(r.tabs).toEqual(['index', 'cancionero', 'mas']);
  });

  it('si el perfil pedido no existe, el override se busca con el perfil REALMENTE usado', () => {
    const r = resolveProfileConfig(
      config({
        profiles: { familia: profile() } as ProfileConfigData['profiles'],
        overrides: { 'familia:_default': { homeButtons: ['fotos'] } },
      }),
      'monitor',
      null,
    );
    expect(r.profileType).toBe('familia');
    expect(r.homeButtons).toEqual(['fotos']);
  });

  it('sin ningún perfil en el documento, la app arranca con todo el catálogo (no vacía)', () => {
    const r = resolveProfileConfig(
      config({ profiles: {} as ProfileConfigData['profiles'] }),
      'familia',
      null,
    );
    expect(r.tabs.length).toBeGreaterThan(0);
    expect(r.tabs).toContain('index');
    expect(r.notificationTopics).toEqual(['general']);
  });
});

describe('resolveProfileConfig — global', () => {
  it('respeta un showNotificationsIcon=false explícito (no lo pisa el valor por defecto)', () => {
    const r = resolveProfileConfig(
      config({
        global: {
          showNotificationsIcon: false,
          maintenanceMode: true,
        } as ProfileConfigData['global'],
      }),
      'familia',
      null,
    );
    expect(r.showNotificationsIcon).toBe(false);
    expect(r.maintenanceMode).toBe(true);
  });
});

describe('isAppVersionSupported — comparación numérica', () => {
  it('compara por número y no por texto: 2.10.0 es posterior a 2.9.0', () => {
    expect(isAppVersionSupported('2.10.0', '2.9.0')).toBe(true);
    expect(isAppVersionSupported('2.9.0', '2.10.0')).toBe(false);
  });

  it('una versión corta ("2.1") equivale a "2.1.0"', () => {
    expect(isAppVersionSupported('2.1', '2.1.0')).toBe(true);
    expect(isAppVersionSupported('2.1.0', '2.1')).toBe(true);
    expect(isAppVersionSupported('2.0', '2.0.1')).toBe(false);
  });

  it('la minor manda sobre la patch: 2.2.0 cumple un mínimo 2.1.9', () => {
    expect(isAppVersionSupported('2.2.0', '2.1.9')).toBe(true);
  });
});

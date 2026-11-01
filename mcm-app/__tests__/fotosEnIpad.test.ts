/** Fotos en iPad (`global.fotosEnIpad`): solo se apagan en iPad y con `false`. */
import { resolveProfileConfig } from '@/utils/resolveProfileConfig';
import type { ProfileBase, ProfileConfigData } from '@/types/profileConfig';

const profile = (): ProfileBase => ({
  label: 'Familia',
  description: '',
  tabs: ['index', 'fotos', 'cancionero', 'mas'],
  homeButtons: ['fotos', 'cancionero', 'mas'],
  masItems: ['jubileo'],
  defaultCalendars: [],
  albumTags: ['general'],
  notificationTopics: ['general'],
});

const config = (global: object): ProfileConfigData =>
  ({
    global,
    profiles: { familia: profile(), monitor: profile(), miembro: profile() },
    delegations: { _default: { label: 'General' } },
  }) as unknown as ProfileConfigData;

describe('fotosEnIpad', () => {
  it('false en iPad: sin Fotos en tabs ni Home, y fotosHidden', () => {
    const r = resolveProfileConfig(
      config({ fotosEnIpad: false }),
      'familia',
      null,
      { isIpad: true },
    );
    expect(r.fotosHidden).toBe(true);
    expect(r.tabs).toEqual(['index', 'cancionero', 'mas']);
    expect(r.homeButtons).toEqual(['cancionero', 'mas']);
  });

  it('false pero fuera de iPad: todo igual', () => {
    const r = resolveProfileConfig(
      config({ fotosEnIpad: false }),
      'familia',
      null,
      { isIpad: false },
    );
    expect(r.fotosHidden).toBe(false);
    expect(r.tabs).toContain('fotos');
  });

  it('ausente o true en iPad: se ven', () => {
    for (const g of [{}, { fotosEnIpad: true }]) {
      const r = resolveProfileConfig(config(g), 'familia', null, {
        isIpad: true,
      });
      expect(r.fotosHidden).toBe(false);
      expect(r.homeButtons).toContain('fotos');
    }
  });

  it('defaultTab fotos cae a index si se ocultan', () => {
    const r = resolveProfileConfig(
      config({ fotosEnIpad: false, defaultTab: 'fotos' }),
      'familia',
      null,
      { isIpad: true },
    );
    expect(r.defaultTab).toBe('index');
  });
});

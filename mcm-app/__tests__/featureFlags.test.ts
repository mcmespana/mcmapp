/**
 * Tests para los feature flags por defecto.
 *
 * ¿Qué testea?
 * - Que los valores por defecto de los feature flags sean correctos
 * - Esto evita que alguien cambie un flag sin querer y rompa la app
 */
import featureFlags from '@/constants/featureFlags';

describe('featureFlags defaults', () => {
  it('tiene las tabs correctas habilitadas por defecto', () => {
    expect(featureFlags.tabs.index).toBe(true);
    expect(featureFlags.tabs.mas).toBe(true);
    expect(featureFlags.tabs.calendario).toBe(true);
    expect(featureFlags.tabs.fotos).toBe(true);
  });

  it('tiene cancionero y comunica deshabilitadas por defecto', () => {
    expect(featureFlags.tabs.cancionero).toBe(false);
    expect(featureFlags.tabs.comunica).toBe(false);
  });

  it('tiene "index" como tab por defecto', () => {
    expect(featureFlags.defaultTab).toBe('index');
  });

  it('muestra el icono de notificaciones por defecto', () => {
    expect(featureFlags.showNotificationsIcon).toBe(true);
  });

  it('NO muestra el prompt de perfil de usuario por defecto', () => {
    expect(featureFlags.showUserProfilePrompt).toBe(false);
  });

  it('NO muestra botón de cambiar nombre por defecto', () => {
    expect(featureFlags.showChangeNameButton).toBe(false);
  });

  it('tiene todas las propiedades necesarias definidas', () => {
    expect(featureFlags).toHaveProperty('tabs');
    expect(featureFlags).toHaveProperty('defaultTab');
    expect(featureFlags).toHaveProperty('showNotificationsIcon');
    expect(featureFlags).toHaveProperty('showUserProfilePrompt');
    expect(featureFlags).toHaveProperty('showChangeNameButton');
  });
});

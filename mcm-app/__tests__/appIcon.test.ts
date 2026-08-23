/**
 * Tests de `utils/appIcon.ts`.
 *
 * `syncAppIcon` cambia el icono del launcher para el modo Carismochito. Las
 * tres garantías que protege: nunca lanza, nunca cambia el icono si ya es el
 * correcto (en iOS cada cambio real dispara una alerta del sistema que no se
 * puede suprimir), y se puede "reparar" forzando el icono por defecto.
 */
import {
  getAppIconName,
  setAlternateAppIcon,
  supportsAlternateIcons,
} from 'expo-alternate-app-icons';
import { logger } from '@/utils/logger';
import { syncAppIcon, CARISMOCHITO_ICON } from '@/utils/appIcon';

jest.mock('expo-alternate-app-icons', () => ({
  getAppIconName: jest.fn(),
  setAlternateAppIcon: jest.fn(),
  supportsAlternateIcons: true,
}));

jest.mock('@/utils/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockModule = jest.requireMock('expo-alternate-app-icons') as {
  supportsAlternateIcons: boolean;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockModule.supportsAlternateIcons = true;
});

describe('syncAppIcon', () => {
  it('no hace nada si la plataforma no soporta iconos alternativos', async () => {
    mockModule.supportsAlternateIcons = false;
    await syncAppIcon(true);
    expect(getAppIconName).not.toHaveBeenCalled();
    expect(setAlternateAppIcon).not.toHaveBeenCalled();
  });

  it('activa el icono Carismochito si no estaba puesto', async () => {
    (getAppIconName as jest.Mock).mockReturnValue(null);
    await syncAppIcon(true);
    expect(setAlternateAppIcon).toHaveBeenCalledWith(CARISMOCHITO_ICON);
  });

  it('no cambia nada si Carismochito ya estaba activo', async () => {
    (getAppIconName as jest.Mock).mockReturnValue(CARISMOCHITO_ICON);
    await syncAppIcon(true);
    expect(setAlternateAppIcon).not.toHaveBeenCalled();
  });

  it('vuelve al icono por defecto (null) si carismochitoActive es false', async () => {
    (getAppIconName as jest.Mock).mockReturnValue(CARISMOCHITO_ICON);
    await syncAppIcon(false);
    expect(setAlternateAppIcon).toHaveBeenCalledWith(null);
  });

  it('no cambia nada si ya está en el icono por defecto y se pide desactivar', async () => {
    (getAppIconName as jest.Mock).mockReturnValue(null);
    await syncAppIcon(false);
    expect(setAlternateAppIcon).not.toHaveBeenCalled();
  });

  it('no lanza si setAlternateAppIcon falla, solo avisa por logger', async () => {
    (getAppIconName as jest.Mock).mockReturnValue(null);
    (setAlternateAppIcon as jest.Mock).mockRejectedValue(new Error('boom'));
    await expect(syncAppIcon(true)).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });
});

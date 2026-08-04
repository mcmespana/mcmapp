// Deep links de acceso a Comunica: la reescritura que hace `+native-intent`
// antes de que arranque la app, y la URL que acaba cargando el WebView.

import { redirectSystemPath } from '@/app/+native-intent';
import {
  buildComunicaAuthUrl,
  consumePendingComunicaAuthUrl,
} from '@/utils/pendingComunicaLink';

const AREA = 'https://comunica.movimientoconsolacion.com/aptest/';
const BRIDGE = 'https://comunica.movimientoconsolacion.com/app/acceso';

afterEach(() => {
  consumePendingComunicaAuthUrl(); // vacía la cola entre pruebas
});

describe('buildComunicaAuthUrl', () => {
  it('monta la URL del área con el token y el modo app', () => {
    expect(buildComunicaAuthUrl({ acceso_magico: 'AbC-123' })).toBe(
      `${AREA}?acceso_magico=AbC-123&app=1`,
    );
  });

  it('descarta parámetros que no son de acceso', () => {
    expect(buildComunicaAuthUrl({ redirect: 'https://malo.example' })).toBe(
      `${AREA}?app=1`,
    );
  });
});

describe('redirectSystemPath', () => {
  it('manda al tab de Comunica y deja el enlace mágico pendiente', () => {
    const to = redirectSystemPath({
      path: `${BRIDGE}?acceso_magico=XYZ`,
      initial: true,
    });

    expect(to).toBe('/(tabs)/comunica');
    expect(consumePendingComunicaAuthUrl()).toBe(
      `${AREA}?acceso_magico=XYZ&app=1`,
    );
  });

  it('acepta también el token permanente', () => {
    redirectSystemPath({ path: `${BRIDGE}?token=abc123`, initial: false });
    expect(consumePendingComunicaAuthUrl()).toBe(`${AREA}?token=abc123&app=1`);
  });

  it('acepta el esquema propio (salida de emergencia)', () => {
    redirectSystemPath({
      path: 'mcmapp://comunica?acceso_magico=XYZ',
      initial: true,
    });
    expect(consumePendingComunicaAuthUrl()).toBe(
      `${AREA}?acceso_magico=XYZ&app=1`,
    );
  });

  it('sin token va al tab igualmente, pero no deja nada pendiente', () => {
    const to = redirectSystemPath({ path: BRIDGE, initial: true });

    expect(to).toBe('/(tabs)/comunica');
    expect(consumePendingComunicaAuthUrl()).toBeNull();
  });

  it('no toca los deep links que no son de Comunica', () => {
    const path = 'https://mcm.expo.app/playlist?p=1234';
    expect(redirectSystemPath({ path, initial: true })).toBe(path);
    expect(consumePendingComunicaAuthUrl()).toBeNull();
  });
});

/**
 * Cola de un hueco del enlace de acceso de Comunica (utils/pendingComunicaLink).
 *
 * Si falla, el usuario pulsa el enlace del correo y la app abre Comunica SIN
 * sesión, o la abre dos veces seguidas con el mismo token (el segundo ya
 * caducado → "enlace no válido"). No hay error en ningún sitio. La traducción
 * del deep link está en `comunicaDeepLink.test.ts`; aquí, la entrega.
 *
 * El módulo guarda estado propio: cada test lo deja vacío antes de empezar.
 */
import * as mod from '@/utils/pendingComunicaLink';

beforeEach(() => {
  // Sin oyente y sin nada pendiente, como recién arrancada la app.
  mod.subscribeComunicaAuthUrl(() => {})();
  mod.consumePendingComunicaAuthUrl();
});

describe('pendingComunicaLink', () => {
  it('con la app cerrada, el enlace espera y se entrega UNA sola vez', () => {
    mod.setPendingComunicaAuthUrl('https://x/ap/?token=a&app=1');
    expect(mod.consumePendingComunicaAuthUrl()).toBe(
      'https://x/ap/?token=a&app=1',
    );
    expect(mod.consumePendingComunicaAuthUrl()).toBeNull();
  });

  it('con la pantalla montada, el enlace va directo a ella y no se queda pendiente', () => {
    const onUrl = jest.fn();
    mod.subscribeComunicaAuthUrl(onUrl);
    mod.setPendingComunicaAuthUrl('u1');
    expect(onUrl).toHaveBeenCalledWith('u1');
    // Si quedara pendiente, el siguiente montaje volvería a cargar un token ya
    // gastado.
    expect(mod.consumePendingComunicaAuthUrl()).toBeNull();
  });

  it('dos enlaces antes de montar: gana el último (el primero ya no sirve)', () => {
    mod.setPendingComunicaAuthUrl('viejo');
    mod.setPendingComunicaAuthUrl('nuevo');
    expect(mod.consumePendingComunicaAuthUrl()).toBe('nuevo');
  });

  it('la baja de una pantalla vieja no desconecta a la nueva que ya se montó', () => {
    const vieja = jest.fn();
    const nueva = jest.fn();
    const bajaVieja = mod.subscribeComunicaAuthUrl(vieja);
    mod.subscribeComunicaAuthUrl(nueva);
    bajaVieja(); // el cleanup del montaje anterior llega tarde
    mod.setPendingComunicaAuthUrl('u');
    expect(nueva).toHaveBeenCalledWith('u');
    expect(vieja).not.toHaveBeenCalled();
  });

  it('tras darse de baja, los enlaces vuelven a quedarse pendientes', () => {
    const baja = mod.subscribeComunicaAuthUrl(jest.fn());
    baja();
    mod.setPendingComunicaAuthUrl('u');
    expect(mod.consumePendingComunicaAuthUrl()).toBe('u');
  });

  it('buildComunicaAuthUrl codifica el token (un "&" no parte la query)', () => {
    const url = mod.buildComunicaAuthUrl({ acceso_magico: 'a&b=c' });
    expect(url).toBe(`${mod.COMUNICA_BASE_URL}?acceso_magico=a%26b%3Dc&app=1`);
  });
});

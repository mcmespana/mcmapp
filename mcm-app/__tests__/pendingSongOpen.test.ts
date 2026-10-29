/**
 * Buzón de «abre esta canción» (`utils/pendingSongOpen`), por el que la
 * paleta ⌘K y el enlace `/cancion?f=…` le pasan una canción al cantoral.
 *
 * Si falla, la canción no se abre, o se abre dos veces (la segunda al volver
 * a montar el cantoral, cuando ya nadie la había pedido).
 */
import * as mod from '@/utils/pendingSongOpen';
import type { SongOpenParams } from '@/utils/songIndex';

const SONG: SongOpenParams = {
  filename: 'alzad.cho',
  title: 'Alzad las manos',
  content: '',
};

beforeEach(() => {
  mod.subscribeSongOpen(() => {})();
  mod.consumePendingSongOpen();
});

describe('pendingSongOpen', () => {
  it('con el cantoral sin montar, la canción espera y se entrega UNA vez', () => {
    mod.requestSongOpen(SONG);
    expect(mod.consumePendingSongOpen()).toEqual(SONG);
    expect(mod.consumePendingSongOpen()).toBeNull();
  });

  it('con el cantoral montado, va directa y no se queda pendiente', () => {
    const onOpen = jest.fn();
    mod.subscribeSongOpen(onOpen);
    mod.requestSongOpen(SONG);
    expect(onOpen).toHaveBeenCalledWith(SONG);
    expect(mod.consumePendingSongOpen()).toBeNull();
  });

  it('darse de baja vuelve a dejar las canciones en espera', () => {
    const onOpen = jest.fn();
    const off = mod.subscribeSongOpen(onOpen);
    off();
    mod.requestSongOpen(SONG);
    expect(onOpen).not.toHaveBeenCalled();
    expect(mod.consumePendingSongOpen()).toEqual(SONG);
  });

  it('la baja de un oyente viejo no quita al nuevo', () => {
    const viejo = jest.fn();
    const nuevo = jest.fn();
    const offViejo = mod.subscribeSongOpen(viejo);
    mod.subscribeSongOpen(nuevo);
    offViejo();
    mod.requestSongOpen(SONG);
    expect(nuevo).toHaveBeenCalledWith(SONG);
    expect(viejo).not.toHaveBeenCalled();
  });
});

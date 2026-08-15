/**
 * Tests de la mini-cola in-memory de deep links (utils/pendingCloudPlaylist.ts).
 *
 * Lo importante aquí es el "consume una sola vez": si un `consume*` no vaciase
 * su hueco, la pantalla de SelectedSongs volvería a importar la misma playlist
 * en cada montaje.
 */
import {
  setPendingCloudPlaylistCode,
  consumePendingCloudPlaylistCode,
  peekPendingCloudPlaylistCode,
  setPendingChoirCode,
  consumePendingChoirCode,
  peekPendingChoirCode,
  setPendingOfflinePlaylist,
  consumePendingOfflinePlaylist,
  setPendingChoirImport,
  consumePendingChoirImport,
} from '@/utils/pendingCloudPlaylist';

afterEach(() => {
  // El módulo guarda estado a nivel de fichero: lo vaciamos entre tests.
  consumePendingCloudPlaylistCode();
  consumePendingChoirCode();
  consumePendingOfflinePlaylist();
  consumePendingChoirImport();
});

describe('código de playlist en la nube', () => {
  it('empieza vacío', () => {
    expect(peekPendingCloudPlaylistCode()).toBeNull();
    expect(consumePendingCloudPlaylistCode()).toBeNull();
  });

  it('se consume una sola vez', () => {
    setPendingCloudPlaylistCode('1234');
    expect(consumePendingCloudPlaylistCode()).toBe('1234');
    expect(consumePendingCloudPlaylistCode()).toBeNull();
  });

  it('peek no vacía la cola', () => {
    setPendingCloudPlaylistCode('9999');
    expect(peekPendingCloudPlaylistCode()).toBe('9999');
    expect(peekPendingCloudPlaylistCode()).toBe('9999');
    expect(consumePendingCloudPlaylistCode()).toBe('9999');
  });

  it('un set posterior pisa al anterior', () => {
    setPendingCloudPlaylistCode('1111');
    setPendingCloudPlaylistCode('2222');
    expect(consumePendingCloudPlaylistCode()).toBe('2222');
  });

  it('se puede limpiar con null', () => {
    setPendingCloudPlaylistCode('1234');
    setPendingCloudPlaylistCode(null);
    expect(consumePendingCloudPlaylistCode()).toBeNull();
  });
});

describe('código de coro', () => {
  it('se consume una sola vez y peek no lo vacía', () => {
    setPendingChoirCode('ABCD');
    expect(peekPendingChoirCode()).toBe('ABCD');
    expect(consumePendingChoirCode()).toBe('ABCD');
    expect(peekPendingChoirCode()).toBeNull();
  });
});

describe('playlist offline e importación de coro', () => {
  it('cada hueco es independiente del resto', () => {
    setPendingOfflinePlaylist('payload-comprimido');
    setPendingChoirImport('coro-1');
    setPendingCloudPlaylistCode('5555');

    expect(consumePendingOfflinePlaylist()).toBe('payload-comprimido');
    // Consumir uno no toca a los demás.
    expect(peekPendingCloudPlaylistCode()).toBe('5555');
    expect(consumePendingChoirImport()).toBe('coro-1');
    expect(consumePendingChoirImport()).toBeNull();
    expect(consumePendingOfflinePlaylist()).toBeNull();
  });
});

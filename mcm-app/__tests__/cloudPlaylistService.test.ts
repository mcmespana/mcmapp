/**
 * Tests del servicio de playlists compartidas (`services/cloudPlaylistService.ts`).
 *
 * Es el ÚNICO sitio de la app donde se borran datos de usuario en la nube:
 * borrado perezoso de las caducadas en `fetchCloudPlaylist`,
 * `deleteCloudPlaylist`, y el movimiento de código. No tenía ningún test,
 * mientras su gemelo estructural `choirSessionService` tiene dieciséis. Una
 * regresión en la comparación de caducidad borraría silenciosamente todas las
 * playlists compartidas y nadie se enteraría hasta las quejas — de ahí el test
 * centinela "vigente → NO se borra".
 *
 * Firebase RTDB está mockeado en `__mocks__/firebase.ts` (mapeado en
 * jest.config.js); aquí se controlan las respuestas por llamada con
 * `mockResolvedValueOnce`, igual que en `choirSessionService.test.ts`.
 */
import { get, set, update, remove } from 'firebase/database';
import {
  cloudPlaylistExists,
  fetchCloudPlaylist,
  uploadCloudPlaylist,
  deleteCloudPlaylist,
  changeCloudPlaylistCode,
} from '@/services/cloudPlaylistService';
import type { SelectedSong } from '@/contexts/SelectedSongsContext';

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6;
const VALID = '1234';
const OTHER = '5678';

// Snapshot al estilo del SDK de Firebase (exists() + val()).
const snapshot = (value: unknown) => ({
  exists: () => value !== null && value !== undefined,
  val: () => value,
});

const sampleSong = (filename: string): SelectedSong =>
  ({ filename, title: filename }) as unknown as SelectedSong;

const playlist = (over: Record<string, unknown> = {}) => ({
  v: 2,
  songs: [sampleSong('a.cho')],
  createdAt: 1_000,
  updatedAt: 2_000,
  expiresAt: Date.now() + SIX_MONTHS_MS,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('validación de código', () => {
  it.each([
    ['abc', 'no numérico'],
    ['12', 'demasiado corto'],
    ['123456', 'demasiado largo'],
    ['', 'vacío'],
  ])('rechaza el código "%s" (%s)', async (code) => {
    await expect(fetchCloudPlaylist(code)).rejects.toThrow(/inválido/i);
    await expect(cloudPlaylistExists(code)).rejects.toThrow(/inválido/i);
    await expect(deleteCloudPlaylist(code)).rejects.toThrow(/inválido/i);
  });
});

describe('fetchCloudPlaylist', () => {
  it('devuelve null cuando no existe, sin borrar nada', async () => {
    (get as jest.Mock).mockResolvedValueOnce(snapshot(null));
    await expect(fetchCloudPlaylist(VALID)).resolves.toBeNull();
    expect(remove).not.toHaveBeenCalled();
  });

  it('playlist vigente: la devuelve y NO la borra', async () => {
    // Centinela de la regresión destructiva: si la comparación de caducidad se
    // invierte, este test se pone rojo antes de que se borre nada de verdad.
    const vigente = playlist();
    (get as jest.Mock).mockResolvedValueOnce(snapshot(vigente));

    await expect(fetchCloudPlaylist(VALID)).resolves.toEqual(vigente);
    expect(remove).not.toHaveBeenCalled();
  });

  it('playlist caducada: devuelve null y la borra', async () => {
    (get as jest.Mock).mockResolvedValueOnce(
      snapshot(playlist({ expiresAt: Date.now() - 1 })),
    );

    await expect(fetchCloudPlaylist(VALID)).resolves.toBeNull();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('sin expiresAt: se considera vigente (no se borra)', async () => {
    const sinCaducidad = playlist({ expiresAt: undefined });
    (get as jest.Mock).mockResolvedValueOnce(snapshot(sinCaducidad));

    await expect(fetchCloudPlaylist(VALID)).resolves.toEqual(sinCaducidad);
    expect(remove).not.toHaveBeenCalled();
  });

  it('caducada y el borrado falla: sigue devolviendo null sin lanzar', async () => {
    (get as jest.Mock).mockResolvedValueOnce(
      snapshot(playlist({ expiresAt: Date.now() - 1 })),
    );
    (remove as jest.Mock).mockRejectedValueOnce(new Error('permission denied'));

    await expect(fetchCloudPlaylist(VALID)).resolves.toBeNull();
  });
});

describe('uploadCloudPlaylist', () => {
  it('sella updatedAt y caduca a 6 meses; createdAt por defecto es ahora', async () => {
    const now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    const result = await uploadCloudPlaylist(VALID, [sampleSong('a.cho')], {
      name: 'Mi lista',
    });

    expect(result.v).toBe(2);
    expect(result.createdAt).toBe(now);
    expect(result.updatedAt).toBe(now);
    expect(result.expiresAt).toBe(now + SIX_MONTHS_MS);
    expect(set).toHaveBeenCalledTimes(1);
  });

  it('respeta el createdAt que le pasen (para preservarlo al mover)', async () => {
    const result = await uploadCloudPlaylist(VALID, [], { createdAt: 42 });
    expect(result.createdAt).toBe(42);
  });

  it('elimina las claves undefined antes de escribir (RTDB las rechaza)', async () => {
    await uploadCloudPlaylist(VALID, [sampleSong('a.cho')]);

    const written = (set as jest.Mock).mock.calls[0][1];
    expect(written).not.toHaveProperty('name');
    expect(written.songs).toHaveLength(1);
  });
});

describe('deleteCloudPlaylist', () => {
  it('borra la playlist', async () => {
    await deleteCloudPlaylist(VALID);
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

describe('changeCloudPlaylistCode', () => {
  it('mismo código: devuelve la actual sin escribir nada', async () => {
    const cur = playlist();
    (get as jest.Mock).mockResolvedValueOnce(snapshot(cur));

    await expect(changeCloudPlaylistCode(VALID, VALID)).resolves.toEqual(cur);
    expect(set).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('mismo código pero ya no existe: lanza', async () => {
    (get as jest.Mock).mockResolvedValueOnce(snapshot(null));
    await expect(changeCloudPlaylistCode(VALID, VALID)).rejects.toThrow(
      /ya no existe/i,
    );
  });

  it('destino ocupado: lanza y no escribe nada', async () => {
    // cloudPlaylistExists(newCode) → existe.
    (get as jest.Mock).mockResolvedValueOnce(snapshot(playlist()));

    await expect(changeCloudPlaylistCode(VALID, OTHER)).rejects.toThrow(
      /ya está en uso/i,
    );
    expect(set).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('origen desaparecido: lanza y no escribe nada', async () => {
    (get as jest.Mock)
      .mockResolvedValueOnce(snapshot(null)) // destino libre
      .mockResolvedValueOnce(snapshot(null)); // origen no existe

    await expect(changeCloudPlaylistCode(VALID, OTHER)).rejects.toThrow(
      /original ya no existe/i,
    );
    expect(set).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('camino feliz: una sola escritura atómica que crea el destino y borra el origen', async () => {
    const now = 1_700_000_555_555;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const cur = playlist({
      name: 'Cantos de Pascua',
      createdAt: 111,
      expiresAt: now + SIX_MONTHS_MS,
    });
    (get as jest.Mock)
      .mockResolvedValueOnce(snapshot(null)) // destino libre
      .mockResolvedValueOnce(snapshot(cur)); // origen existe

    const moved = await changeCloudPlaylistCode(VALID, OTHER);

    expect(moved.name).toBe('Cantos de Pascua');
    expect(moved.createdAt).toBe(111); // se preserva
    expect(moved.updatedAt).toBe(now);
    expect(moved.expiresAt).toBe(now + SIX_MONTHS_MS);

    // Un único `update` multi-path: si el borrado del origen fuera un paso
    // aparte y fallase, quedarían dos copias vivas de la misma playlist.
    expect(update).toHaveBeenCalledTimes(1);
    expect(set).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();

    const payload = (update as jest.Mock).mock.calls[0][1];
    expect(Object.keys(payload).sort()).toEqual([OTHER, VALID].sort());
    expect(payload[VALID]).toBeNull(); // el origen se borra en la misma op
    expect(payload[OTHER].createdAt).toBe(111);
    expect(payload[OTHER].songs).toHaveLength(1);
  });

  it('al mover, las claves undefined no llegan a RTDB', async () => {
    (get as jest.Mock)
      .mockResolvedValueOnce(snapshot(null))
      .mockResolvedValueOnce(snapshot(playlist({ name: undefined })));

    await changeCloudPlaylistCode(VALID, OTHER);

    const payload = (update as jest.Mock).mock.calls[0][1];
    expect(payload[OTHER]).not.toHaveProperty('name');
  });
});

/**
 * Tests de `services/cloudPlaylistService.ts` — el único sitio de la app
 * donde se BORRAN datos de usuario en la nube (playlists compartidas bajo
 * código de 4 dígitos). Antes sin cobertura, a diferencia de su gemelo
 * estructural `choirSessionService` (mismo patrón, mismo RTDB mockeado).
 *
 * Firebase RTDB está mockeado en `__mocks__/firebase.ts` (mapeado en
 * jest.config.js); aquí controlamos las respuestas por llamada con
 * `mockResolvedValueOnce`.
 */
import { get, set, remove, update } from 'firebase/database';
import {
  cloudPlaylistExists,
  fetchCloudPlaylist,
  uploadCloudPlaylist,
  changeCloudPlaylistCode,
} from '@/services/cloudPlaylistService';
import type { SelectedSong } from '@/contexts/SelectedSongsContext';

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6;
const VALID = '1234';
const OTHER = '5678';

// Snapshot factory al estilo del SDK de Firebase (exists() + val()).
const snapshot = (value: unknown) => ({
  exists: () => value !== null && value !== undefined,
  val: () => value,
});

const sampleSong = (filename: string): SelectedSong =>
  ({ filename, title: filename }) as unknown as SelectedSong;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('validación de código (getRef indirecto)', () => {
  it.each([
    ['12', 'demasiado corto'],
    ['abcd', 'no numérico'],
    ['', 'vacío'],
  ])('rechaza el código "%s" (%s)', async (code) => {
    await expect(cloudPlaylistExists(code)).rejects.toThrow(/inválido/i);
  });
});

describe('fetchCloudPlaylist', () => {
  it('snapshot inexistente → null, sin remove', async () => {
    (get as jest.Mock).mockResolvedValueOnce(snapshot(null));
    await expect(fetchCloudPlaylist(VALID)).resolves.toBeNull();
    expect(remove).not.toHaveBeenCalled();
  });

  it('playlist caducada → null Y llama a remove una vez', async () => {
    const expired = { v: 2, songs: [], expiresAt: Date.now() - 1000 };
    (get as jest.Mock).mockResolvedValueOnce(snapshot(expired));
    (remove as jest.Mock).mockResolvedValueOnce(undefined);
    await expect(fetchCloudPlaylist(VALID)).resolves.toBeNull();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('playlist vigente → la devuelve Y remove NO se llama', async () => {
    const alive = { v: 2, songs: [], expiresAt: Date.now() + 1000 };
    (get as jest.Mock).mockResolvedValueOnce(snapshot(alive));
    await expect(fetchCloudPlaylist(VALID)).resolves.toEqual(alive);
    expect(remove).not.toHaveBeenCalled();
  });

  it('caducada y remove falla → sigue devolviendo null sin lanzar', async () => {
    const expired = { v: 2, songs: [], expiresAt: Date.now() - 1000 };
    (get as jest.Mock).mockResolvedValueOnce(snapshot(expired));
    (remove as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    await expect(fetchCloudPlaylist(VALID)).resolves.toBeNull();
  });
});

describe('uploadCloudPlaylist', () => {
  it('elimina name: undefined del payload escrito y fija expiresAt a +6 meses', async () => {
    const now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    const playlist = [sampleSong('a.cho')];
    const result = await uploadCloudPlaylist(VALID, playlist);

    expect(result.expiresAt).toBe(now + SIX_MONTHS_MS);
    const written = (set as jest.Mock).mock.calls[0][1];
    expect(written).not.toHaveProperty('name');
  });

  it('respeta createdAt si viene en opts', async () => {
    const createdAt = 1_600_000_000_000;
    const result = await uploadCloudPlaylist(VALID, [], { createdAt });
    expect(result.createdAt).toBe(createdAt);
  });
});

describe('changeCloudPlaylistCode', () => {
  it('mismo código: devuelve la actual sin escribir', async () => {
    const current = { v: 2, songs: [], expiresAt: Date.now() + 1000 };
    (get as jest.Mock).mockResolvedValueOnce(snapshot(current));

    await expect(changeCloudPlaylistCode(VALID, VALID)).resolves.toEqual(
      current,
    );
    expect(set).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('mismo código pero ya no existe: lanza "La playlist ya no existe"', async () => {
    (get as jest.Mock).mockResolvedValueOnce(snapshot(null));
    await expect(changeCloudPlaylistCode(VALID, VALID)).rejects.toThrow(
      'La playlist ya no existe',
    );
  });

  it('destino ocupado: lanza y no escribe nada', async () => {
    // cloudPlaylistExists(newCode) → existe
    (get as jest.Mock).mockResolvedValueOnce(snapshot({ v: 2 }));
    await expect(changeCloudPlaylistCode(VALID, OTHER)).rejects.toThrow(
      'El nuevo código ya está en uso',
    );
    expect(set).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('camino feliz: update() atómico — destino recibe el payload, origen se borra en la MISMA llamada', async () => {
    const cur = {
      v: 2,
      songs: [sampleSong('z.cho')],
      name: 'Mi playlist',
      createdAt: 111,
      expiresAt: Date.now() + 1000,
    };
    (get as jest.Mock)
      .mockResolvedValueOnce(snapshot(null)) // newCode libre
      .mockResolvedValueOnce(snapshot(cur)); // fetch del original

    const moved = await changeCloudPlaylistCode(VALID, OTHER);

    expect(moved.songs).toEqual(cur.songs);
    expect(moved.createdAt).toBe(111);

    // Un solo update() con ambas claves: destino=payload, origen=null.
    // Ya NO hay set()+remove() separados para el movimiento.
    expect(update).toHaveBeenCalledTimes(1);
    const payload = (update as jest.Mock).mock.calls[0][1];
    expect(payload[OTHER].songs).toEqual(cur.songs);
    expect(payload[VALID]).toBeNull();
    expect(set).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});

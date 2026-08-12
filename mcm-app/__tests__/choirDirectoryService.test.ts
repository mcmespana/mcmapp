/**
 * Tests de `services/choirDirectoryService.ts` — el directorio de coros del
 * que cuelgan las playlists.
 *
 * Firebase RTDB está mockeado en `__mocks__/firebase.ts` (mapeado en
 * jest.config.js); aquí controlamos las respuestas por llamada con
 * `mockResolvedValueOnce`.
 */
import { get, set, update, remove } from 'firebase/database';
import {
  choirLatestPlaylist,
  choirPlaylists,
  createChoir,
  deleteChoir,
  fetchChoir,
  listChoirs,
  removeChoirPlaylist,
  upsertChoirPlaylist,
} from '@/services/choirDirectoryService';

const snapshot = (value: unknown) => ({
  exists: () => value !== null && value !== undefined,
  val: () => value,
});

const CHOIR_ID = 'consolacion-castellon-4f2a';

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('validación del id (getRef indirecto)', () => {
  it.each([['1234'], ['sinGuion'], ['']])('rechaza el id «%s»', async (id) => {
    await expect(fetchChoir(id)).rejects.toThrow(/inválido/i);
  });
});

describe('listChoirs', () => {
  it('sin coros → lista vacía', async () => {
    (get as jest.Mock).mockResolvedValueOnce(snapshot(null));
    await expect(listChoirs()).resolves.toEqual([]);
  });

  it('ordena por nombre y rellena los huecos del nodo', async () => {
    (get as jest.Mock).mockResolvedValueOnce(
      snapshot({
        'zeta-0001': { name: 'Zeta', createdAt: 1 },
        'alfa-0002': { name: 'Alfa', createdAt: 2, playlists: {} },
      }),
    );
    const choirs = await listChoirs();
    expect(choirs.map((c) => c.name)).toEqual(['Alfa', 'Zeta']);
    // Un coro sin `playlists` en Firebase no puede reventar la pantalla.
    expect(choirs[1].playlists).toEqual({});
    expect(choirs[1].nameKey).toBe('zeta');
  });

  it('hidrata las entradas de playlist con su código como clave', async () => {
    (get as jest.Mock).mockResolvedValueOnce(
      snapshot({
        [CHOIR_ID]: {
          name: 'Consolación',
          playlists: {
            '1234': { name: 'Domingo', updatedAt: 200, songCount: 5 },
            '5678': { name: 'Vigilia', createdAt: 100 },
          },
        },
      }),
    );
    const [choir] = await listChoirs();
    const entries = choirPlaylists(choir);
    expect(entries.map((e) => e.code)).toEqual(['1234', '5678']);
    // Sin `updatedAt` propio se cae a `createdAt`, para no ordenar por 0.
    expect(entries[1].updatedAt).toBe(100);
    expect(choirLatestPlaylist(choir)?.code).toBe('1234');
  });
});

describe('createChoir', () => {
  it('rechaza nombres demasiado cortos sin tocar Firebase', async () => {
    await expect(createChoir('AB', { deviceId: 'd1' })).rejects.toThrow(
      /corto/i,
    );
    expect(set).not.toHaveBeenCalled();
  });

  it('avisa (y no crea) si ya existe uno con el mismo nombre', async () => {
    (get as jest.Mock).mockResolvedValueOnce(
      snapshot({ [CHOIR_ID]: { name: 'Coro Consolación Castellón' } }),
    );
    await expect(
      createChoir('coro  consolacion castellon', { deviceId: 'd1' }),
    ).rejects.toThrow(/Ya existe/);
    expect(set).not.toHaveBeenCalled();
  });

  it('crea el coro con nameKey, createdBy y sin claves undefined', async () => {
    (get as jest.Mock).mockResolvedValueOnce(snapshot(null));
    const created = await createChoir('Coro Consolación Castellón', {
      deviceId: 'd1',
    });

    expect(created.id).toMatch(/^coro-consolacion-castellon-/);
    expect(created.nameKey).toBe('coro-consolacion-castellon');
    expect(created.playlists).toEqual({});
    const written = (set as jest.Mock).mock.calls[0][1];
    expect(written.createdBy).toEqual({ deviceId: 'd1' });
    expect(written.createdBy).not.toHaveProperty('name');
  });
});

describe('índice de playlists', () => {
  it('upsert escribe la entrada y refresca el updatedAt del coro', async () => {
    const now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    await upsertChoirPlaylist(CHOIR_ID, {
      code: '1234',
      name: 'Domingo',
      createdAt: 0,
      updatedAt: 0,
      songCount: 7,
      ownerDeviceId: 'd1',
    });

    const payload = (update as jest.Mock).mock.calls[0][1];
    expect(payload['playlists/1234']).toMatchObject({
      name: 'Domingo',
      songCount: 7,
      updatedAt: now,
      ownerDeviceId: 'd1',
    });
    // `createdAt: 0` significa "nueva", no "1 de enero de 1970".
    expect(payload['playlists/1234'].createdAt).toBe(now);
    expect(payload.updatedAt).toBe(now);
  });

  it('remove borra solo esa entrada (null), no el coro', async () => {
    await removeChoirPlaylist(CHOIR_ID, '1234');
    const payload = (update as jest.Mock).mock.calls[0][1];
    expect(payload['playlists/1234']).toBeNull();
    expect(remove).not.toHaveBeenCalled();
  });

  it('deleteChoir sí borra el nodo entero', async () => {
    await deleteChoir(CHOIR_ID);
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

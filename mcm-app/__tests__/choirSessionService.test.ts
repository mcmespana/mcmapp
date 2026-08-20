/**
 * Tests del servicio "Modo Coro" (services/choirSessionService.ts).
 *
 * Cubre la lógica de coordinación maestro/oyentes que vive en el cliente
 * (PLAN_CALIDAD §5.2): validación de códigos, forma del payload publicado en
 * Firebase, expiración a 12h con alargue por actividad, limpieza de
 * `undefined`, y el traspaso de sesión entre códigos
 * (`changeChoirSessionCode`) con sus casos de error.
 *
 * Firebase RTDB está mockeado en `__mocks__/firebase.ts` (mapeado en
 * jest.config.js); aquí controlamos las respuestas por llamada con
 * `mockResolvedValueOnce`.
 */
import { get, set, update, remove, onValue } from 'firebase/database';
import {
  createChoirSession,
  fetchChoirSession,
  choirSessionExists,
  publishChoirCurrent,
  publishChoirPlaylist,
  changeChoirSessionCode,
  closeChoirSession,
  subscribeChoirSession,
  shouldRenewChoirSession,
  extendChoirSession,
  CHOIR_SESSION_TTL_MS,
  CHOIR_SESSION_RENEWAL_WINDOW_MS,
  CHOIR_SESSION_EXTENSION_MS,
} from '@/services/choirSessionService';
import type { ChoirSession } from '@/services/choirSessionService';
import type { SelectedSong } from '@/contexts/SelectedSongsContext';

const SESSION_TTL_MS = CHOIR_SESSION_TTL_MS;
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

describe('validación de código', () => {
  it.each([
    ['abc', 'no numérico'],
    ['12', 'demasiado corto'],
    ['123456', 'demasiado largo'],
    ['', 'vacío'],
  ])('rechaza la clave "%s" (%s)', async (code) => {
    await expect(choirSessionExists(code)).rejects.toThrow(/inválido/i);
  });

  it('acepta un código de 4 dígitos', async () => {
    (get as jest.Mock).mockResolvedValueOnce(snapshot(null));
    await expect(choirSessionExists(VALID)).resolves.toBe(false);
  });
});

describe('createChoirSession', () => {
  it('construye el payload con expiración a 12 h y current nulo', async () => {
    const now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    const playlist = [sampleSong('a.cho'), sampleSong('b.cho')];
    const result = await createChoirSession(
      VALID,
      { deviceId: 'dev-1', name: 'Coro Test' },
      playlist,
    );

    expect(result.v).toBe(1);
    expect(result.master.deviceId).toBe('dev-1');
    expect(result.current).toBeNull();
    expect(result.createdAt).toBe(now);
    expect(result.startedAt).toBe(now);
    expect(result.expiresAt).toBe(now + SESSION_TTL_MS);
    expect(result.playlist).toHaveLength(2);
    expect(set).toHaveBeenCalledTimes(1);
  });

  it('elimina las claves undefined antes de escribir (RTDB las rechaza)', async () => {
    // master sin `name` → no debe colarse `name: undefined` en lo que se escribe.
    await createChoirSession(VALID, { deviceId: 'dev-1' }, []);

    const written = (set as jest.Mock).mock.calls[0][1];
    expect(written.master).not.toHaveProperty('name');
    expect(written.master.deviceId).toBe('dev-1');
  });
});

describe('fetchChoirSession', () => {
  it('devuelve null cuando la sesión no existe', async () => {
    (get as jest.Mock).mockResolvedValueOnce(snapshot(null));
    await expect(fetchChoirSession(VALID)).resolves.toBeNull();
  });

  it('devuelve el valor cuando existe', async () => {
    const session = { v: 1, master: { deviceId: 'x' } };
    (get as jest.Mock).mockResolvedValueOnce(snapshot(session));
    await expect(fetchChoirSession(VALID)).resolves.toEqual(session);
  });
});

describe('publicaciones del maestro', () => {
  it('publishChoirCurrent sella updatedAt y refresca master/lastSeen', async () => {
    const now = 1_700_000_111_111;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    await publishChoirCurrent(VALID, { filename: 'c.cho', transpose: 2 });

    const payload = (update as jest.Mock).mock.calls[0][1];
    expect(payload.current.filename).toBe('c.cho');
    expect(payload.current.transpose).toBe(2);
    expect(payload.current.updatedAt).toBe(now);
    expect(payload['master/lastSeen']).toBe(now);
    // publishChoirCurrent por sí solo NO alarga la caducidad: eso lo decide
    // el llamador con shouldRenewChoirSession + extendChoirSession (abajo).
    expect(payload).not.toHaveProperty('expiresAt');
  });

  it('publishChoirPlaylist actualiza la playlist y la actividad', async () => {
    await publishChoirPlaylist(VALID, [sampleSong('z.cho')]);
    const payload = (update as jest.Mock).mock.calls[0][1];
    expect(payload.playlist).toHaveLength(1);
    expect(payload).toHaveProperty('lastActivity');
  });
});

describe('shouldRenewChoirSession', () => {
  const baseSession = (overrides: Partial<ChoirSession> = {}): ChoirSession =>
    ({
      v: 1,
      master: { deviceId: 'dev-1', lastSeen: 0 },
      playlist: [],
      current: null,
      createdAt: 0,
      startedAt: 0,
      updatedAt: 0,
      lastActivity: 0,
      expiresAt: SESSION_TTL_MS,
      ...overrides,
    }) as ChoirSession;

  it('no alarga una sesión ya caducada', () => {
    const now = SESSION_TTL_MS + 1;
    expect(shouldRenewChoirSession(baseSession(), now)).toBe(false);
  });

  it('no alarga si aún faltan más de 2 h para caducar', () => {
    const now = SESSION_TTL_MS - CHOIR_SESSION_RENEWAL_WINDOW_MS - 1;
    expect(shouldRenewChoirSession(baseSession(), now)).toBe(false);
  });

  it('alarga si quedan 2 h o menos para caducar (dentro de la ventana)', () => {
    const now = SESSION_TTL_MS - CHOIR_SESSION_RENEWAL_WINDOW_MS;
    expect(shouldRenewChoirSession(baseSession(), now)).toBe(true);
  });

  it('alarga justo en el límite de la ventana (falta 1ms más)', () => {
    const now = SESSION_TTL_MS - CHOIR_SESSION_RENEWAL_WINDOW_MS + 1;
    expect(shouldRenewChoirSession(baseSession(), now)).toBe(true);
  });

  it('no revienta ni alarga con sesión null', () => {
    expect(shouldRenewChoirSession(null, 0)).toBe(false);
  });
});

describe('extendChoirSession', () => {
  it('escribe expiresAt = ahora + 12h y refresca actividad/lastSeen', async () => {
    const now = 1_700_000_500_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    await extendChoirSession(VALID);

    const payload = (update as jest.Mock).mock.calls[0][1];
    expect(payload.expiresAt).toBe(now + CHOIR_SESSION_EXTENSION_MS);
    expect(payload.updatedAt).toBe(now);
    expect(payload.lastActivity).toBe(now);
    expect(payload['master/lastSeen']).toBe(now);
  });

  it('rechaza un código inválido, igual que el resto de operaciones', async () => {
    await expect(extendChoirSession('abc')).rejects.toThrow(/inválido/i);
  });
});

describe('changeChoirSessionCode', () => {
  it('si el código nuevo es igual al viejo, devuelve la sesión actual sin mover', async () => {
    const session = { v: 1, master: { deviceId: 'x' } };
    (get as jest.Mock).mockResolvedValueOnce(snapshot(session));

    await expect(changeChoirSessionCode(VALID, VALID)).resolves.toEqual(
      session,
    );
    expect(set).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('falla si el código nuevo ya está ocupado', async () => {
    // choirSessionExists(newCode) → existe.
    (get as jest.Mock).mockResolvedValueOnce(snapshot({ v: 1 }));
    await expect(changeChoirSessionCode(VALID, OTHER)).rejects.toThrow(
      /ya está en uso/i,
    );
    expect(remove).not.toHaveBeenCalled();
  });

  it('falla si la sesión original ya no existe', async () => {
    // newCode libre, luego fetch del original → null.
    (get as jest.Mock)
      .mockResolvedValueOnce(snapshot(null))
      .mockResolvedValueOnce(snapshot(null));
    await expect(changeChoirSessionCode(VALID, OTHER)).rejects.toThrow(
      /original ya no existe/i,
    );
  });

  it('mueve la sesión: escribe en el nuevo código y borra el viejo', async () => {
    const session = { v: 1, master: { deviceId: 'x' }, createdAt: 1 };
    (get as jest.Mock)
      .mockResolvedValueOnce(snapshot(null)) // newCode libre
      .mockResolvedValueOnce(snapshot(session)); // original existe

    const moved = await changeChoirSessionCode(VALID, OTHER);

    expect(moved.master.deviceId).toBe('x');
    expect(set).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

describe('subscribeChoirSession', () => {
  it('la limpieza devuelta ES el Unsubscribe de onValue (no un no-op)', () => {
    const mockUnsubscribe = jest.fn();
    (onValue as jest.Mock).mockReturnValueOnce(mockUnsubscribe);

    const cleanup = subscribeChoirSession(VALID, jest.fn());
    cleanup();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('closeChoirSession', () => {
  it('borra la sesión', async () => {
    await closeChoirSession(VALID);
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

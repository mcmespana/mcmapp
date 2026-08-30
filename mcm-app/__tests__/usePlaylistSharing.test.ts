/**
 * Tests de `usePlaylistSharing`: los flujos de "compartir la playlist"
 * (importar, guardar, dirigir/seguir un coro en vivo). Las reglas de negocio
 * que este hook encierra y que valen la pena blindar:
 *
 *  - Importar SIEMPRE reemplaza con deshacer de 10 s, y deshacer restaura
 *    también el enlace con la nube (no solo las canciones).
 *  - Actualizar una playlist ajena pide contraseña; la tuya (mismo código+
 *    owned, o mismo deviceId de origen) se actualiza directo.
 *  - Tomar el mando de un coro sin líder (o siendo tú el líder ya) es
 *    directo; quitarle el mando a otra persona pide contraseña.
 *  - Al importar una playlist de un coro nuevo (sin coro elegido aún), se
 *    adopta automáticamente ese coro.
 *
 * Todas las dependencias (contexts, hooks y servicios) van mockeadas: aquí
 * se testea solo la orquestación de `usePlaylistSharing`.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useToast } from '@/contexts/AppToastContext';
import { useSelectedSongs } from '@/contexts/SelectedSongsContext';
import { useChoirSession } from '@/contexts/ChoirSessionContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useMyChoir } from '@/hooks/useMyChoir';
import { usePlaylistLink } from '@/hooks/usePlaylistLink';
import {
  allocateFreeCode,
  fetchCloudPlaylist,
  uploadCloudPlaylist,
} from '@/services/cloudPlaylistService';
import {
  fetchChoir,
  choirLatestPlaylist,
  upsertChoirPlaylist,
} from '@/services/choirDirectoryService';
import { isSameLeader } from '@/services/choirSessionService';
import { usePlaylistSharing } from '@/hooks/usePlaylistSharing';

jest.mock('@/contexts/AppToastContext', () => ({
  useToast: jest.fn(),
}));
jest.mock('@/contexts/SelectedSongsContext', () => ({
  useSelectedSongs: jest.fn(),
}));
jest.mock('@/contexts/ChoirSessionContext', () => ({
  useChoirSession: jest.fn(),
}));
jest.mock('@/contexts/UserProfileContext', () => ({
  useUserProfile: jest.fn(),
}));
jest.mock('@/hooks/useMyChoir', () => ({
  useMyChoir: jest.fn(),
}));
jest.mock('@/hooks/usePlaylistLink', () => ({
  usePlaylistLink: jest.fn(),
}));
jest.mock('@/services/cloudPlaylistService', () => ({
  allocateFreeCode: jest.fn(() => Promise.resolve('1234')),
  fetchCloudPlaylist: jest.fn(),
  uploadCloudPlaylist: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/services/choirDirectoryService', () => ({
  fetchChoir: jest.fn(),
  choirLatestPlaylist: jest.fn(),
  upsertChoirPlaylist: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/services/choirSessionService', () => ({
  isSameLeader: jest.fn(() => true),
}));
jest.mock('@/utils/playlistSync', () => ({
  playlistSignature: jest.fn(() => 'sig-current'),
}));
jest.mock('@/utils/analytics', () => ({ trackEvent: jest.fn() }));

const song = (filename: string) => ({
  filename,
  transpose: 0,
  order: 0,
  addedAt: 0,
});

let mockSelectedSongs: any[];
let mockReplaceAll: jest.Mock;
let mockClearSelection: jest.Mock;
let mockLink: any;
let mockSetLink: jest.Mock;
let mockChoir: any;
let mockSetChoir: jest.Mock;
let mockToastShow: jest.Mock;
let mockStartAsMaster: jest.Mock;
let mockJoinAsSlave: jest.Mock;
let mockLeave: jest.Mock;

function setup() {
  mockSelectedSongs = [song('a.cho')];
  mockReplaceAll = jest.fn();
  mockClearSelection = jest.fn();
  mockLink = null;
  mockSetLink = jest.fn();
  mockChoir = null;
  mockSetChoir = jest.fn();
  mockToastShow = jest.fn();
  mockStartAsMaster = jest.fn(() => Promise.resolve());
  mockJoinAsSlave = jest.fn(() => Promise.resolve());
  mockLeave = jest.fn(() => Promise.resolve());

  (useSelectedSongs as jest.Mock).mockImplementation(() => ({
    selectedSongs: mockSelectedSongs,
    replaceAll: mockReplaceAll,
    clearSelection: mockClearSelection,
  }));
  (useUserProfile as jest.Mock).mockReturnValue({
    profile: { name: 'Ana' },
  });
  (useChoirSession as jest.Mock).mockImplementation(() => ({
    deviceId: 'device-1',
    startAsMaster: mockStartAsMaster,
    joinAsSlave: mockJoinAsSlave,
    leave: mockLeave,
  }));
  (useToast as jest.Mock).mockReturnValue({ toast: { show: mockToastShow } });
  (useMyChoir as jest.Mock).mockImplementation(() => ({
    choir: mockChoir,
    setChoir: mockSetChoir,
  }));
  (usePlaylistLink as jest.Mock).mockImplementation(() => ({
    link: mockLink,
    setLink: mockSetLink,
  }));
}

async function mount() {
  return renderHook(() => usePlaylistSharing({ onShowQr: jest.fn() }));
}

beforeEach(() => {
  jest.clearAllMocks();
  setup();
});

describe('isSynced', () => {
  it('true cuando el link coincide con la firma actual', async () => {
    mockLink = { code: '1234', signature: 'sig-current', owned: true };
    const { result } = await mount();
    expect(result.current.isSynced).toBe(true);
  });

  it('false si la firma difiere (hay cambios sin guardar)', async () => {
    mockLink = { code: '1234', signature: 'sig-vieja', owned: true };
    const { result } = await mount();
    expect(result.current.isSynced).toBe(false);
  });

  it('false sin ningún link', async () => {
    const { result } = await mount();
    expect(result.current.isSynced).toBe(false);
  });
});

describe('replaceWithUndo', () => {
  it('reemplaza la lista y deshacer restaura canciones + link anteriores', async () => {
    mockLink = { code: 'old', signature: 'sig-current', owned: true };
    const { result } = await mount();
    const nextLink = {
      code: 'new',
      signature: 'sig2',
      owned: false,
      syncedAt: 0,
    };

    await act(async () =>
      result.current.replaceWithUndo([song('b.cho')], 'Importada', nextLink),
    );
    expect(mockReplaceAll).toHaveBeenCalledWith([song('b.cho')]);
    expect(mockSetLink).toHaveBeenCalledWith(nextLink);

    const toastCall = mockToastShow.mock.calls[0][0];
    expect(toastCall.actionLabel).toBe('Deshacer');
    toastCall.onActionPress({ hide: jest.fn() });
    expect(mockReplaceAll).toHaveBeenLastCalledWith(mockSelectedSongs);
    expect(mockSetLink).toHaveBeenLastCalledWith(mockLink);
  });
});

describe('clearWithUndo', () => {
  it('no hace nada si ya está vacía', async () => {
    mockSelectedSongs = [];
    const { result } = await mount();
    await act(async () => result.current.clearWithUndo());
    expect(mockClearSelection).not.toHaveBeenCalled();
  });

  it('vacía la lista y deshacer la restaura', async () => {
    const { result } = await mount();
    await act(async () => result.current.clearWithUndo());
    expect(mockClearSelection).toHaveBeenCalled();
    const toastCall = mockToastShow.mock.calls[0][0];
    toastCall.onActionPress({ hide: jest.fn() });
    expect(mockReplaceAll).toHaveBeenCalledWith(mockSelectedSongs);
  });
});

describe('importByCode', () => {
  it('importa y reemplaza con deshacer', async () => {
    (fetchCloudPlaylist as jest.Mock).mockResolvedValue({
      songs: [song('c.cho')],
      name: 'Domingo',
    });
    const { result } = await mount();
    await act(async () => result.current.importByCode('5678'));
    expect(mockReplaceAll).toHaveBeenCalledWith([song('c.cho')]);
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ label: '«Domingo» importada' }),
    );
  });

  it('lanza si el código no existe', async () => {
    (fetchCloudPlaylist as jest.Mock).mockResolvedValue(null);
    const { result } = await mount();
    await expect(result.current.importByCode('0000')).rejects.toThrow(
      /no existe/i,
    );
  });

  it('adopta el coro de la playlist importada si aún no tenías uno', async () => {
    mockChoir = null;
    (fetchCloudPlaylist as jest.Mock).mockResolvedValue({
      songs: [song('c.cho')],
      choirId: 'coro-1',
      choirName: 'Coro Uno',
    });
    const { result } = await mount();
    await act(async () => result.current.importByCode('5678'));
    expect(mockSetChoir).toHaveBeenCalledWith({ id: 'coro-1', name: 'Coro Uno' });
  });

  it('NO pisa el coro ya elegido aunque la playlist declare otro', async () => {
    mockChoir = { id: 'mio', name: 'Mi coro' };
    (fetchCloudPlaylist as jest.Mock).mockResolvedValue({
      songs: [song('c.cho')],
      choirId: 'coro-1',
      choirName: 'Coro Uno',
    });
    const { result } = await mount();
    await act(async () => result.current.importByCode('5678'));
    expect(mockSetChoir).not.toHaveBeenCalled();
  });
});

describe('importEntry', () => {
  it('si importByCode falla, muestra un toast en vez de propagar', async () => {
    (fetchCloudPlaylist as jest.Mock).mockResolvedValue(null);
    const { result } = await mount();
    await act(async () =>
      result.current.importEntry(
        { code: '0000', name: 'X' } as any,
        { id: 'c1', name: 'Coro' },
      ),
    );
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'danger' }),
    );
  });
});

describe('importLatestFromChoir', () => {
  it('lanza si el coro ya no existe', async () => {
    (fetchChoir as jest.Mock).mockResolvedValue(null);
    const { result } = await mount();
    await expect(
      result.current.importLatestFromChoir('coro-1'),
    ).rejects.toThrow(/ya no existe/i);
  });

  it('lanza si el coro no tiene playlists', async () => {
    (fetchChoir as jest.Mock).mockResolvedValue({ id: 'coro-1', name: 'Uno' });
    (choirLatestPlaylist as jest.Mock).mockReturnValue(null);
    const { result } = await mount();
    await expect(
      result.current.importLatestFromChoir('coro-1'),
    ).rejects.toThrow(/aún no tiene playlists/i);
  });

  it('importa la última playlist del coro', async () => {
    (fetchChoir as jest.Mock).mockResolvedValue({ id: 'coro-1', name: 'Uno' });
    (choirLatestPlaylist as jest.Mock).mockReturnValue({
      code: '9999',
      name: 'Última',
    });
    (fetchCloudPlaylist as jest.Mock).mockResolvedValue({
      songs: [song('d.cho')],
    });
    const { result } = await mount();
    await act(async () => result.current.importLatestFromChoir('coro-1'));
    expect(fetchCloudPlaylist).toHaveBeenCalledWith('9999');
  });
});

describe('saveNew', () => {
  it('asigna código y publica', async () => {
    const { result } = await mount();
    await act(async () =>
      result.current.saveNew('Nueva', { id: 'coro-1', name: 'Coro' }),
    );
    expect(allocateFreeCode).toHaveBeenCalled();
    expect(uploadCloudPlaylist).toHaveBeenCalledWith(
      '1234',
      mockSelectedSongs,
      expect.objectContaining({ name: 'Nueva', choirId: 'coro-1' }),
    );
    expect(upsertChoirPlaylist).toHaveBeenCalled();
  });

  it('si ya hay una subida en curso, ignora la segunda llamada', async () => {
    (allocateFreeCode as jest.Mock).mockImplementation(
      () => new Promise(() => {}), // nunca resuelve → busy queda true
    );
    const { result } = await mount();
    await act(async () => {
      result.current.saveNew('A', { id: 'c1', name: 'Coro' });
    });
    await waitFor(() => expect(result.current.busy).toBe(true));
    await act(async () =>
      result.current.saveNew('B', { id: 'c1', name: 'Coro' }),
    );
    expect(allocateFreeCode).toHaveBeenCalledTimes(1);
  });

  it('un fallo al publicar muestra un toast de error', async () => {
    (allocateFreeCode as jest.Mock).mockRejectedValue(new Error('sin red'));
    const { result } = await mount();
    await act(async () =>
      result.current.saveNew('Nueva', { id: 'coro-1', name: 'Coro' }),
    );
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'danger' }),
    );
    expect(result.current.busy).toBe(false);
  });
});

describe('saveUpdate', () => {
  it('actualiza sin pedir contraseña si la subiste tú (mismo código + owned)', async () => {
    mockLink = { code: '1234', owned: true };
    const { result } = await mount();
    await act(async () =>
      result.current.saveUpdate(
        { code: '1234', name: 'Mia', createdAt: 1 } as any,
        { id: 'c1', name: 'Coro' },
      ),
    );
    await waitFor(() => expect(uploadCloudPlaylist).toHaveBeenCalled());
    expect(result.current.passwordRequest).toBeNull();
  });

  it('actualiza sin pedir contraseña si la subiste desde este dispositivo', async () => {
    const { result } = await mount();
    await act(async () =>
      result.current.saveUpdate(
        { code: '5555', name: 'Mia', ownerDeviceId: 'device-1' } as any,
        { id: 'c1', name: 'Coro' },
      ),
    );
    await waitFor(() => expect(uploadCloudPlaylist).toHaveBeenCalled());
  });

  it('pide contraseña si la subió otra persona/dispositivo', async () => {
    const { result } = await mount();
    await act(async () =>
      result.current.saveUpdate(
        { code: '5555', name: 'Ajena', ownerDeviceId: 'otro-device' } as any,
        { id: 'c1', name: 'Coro' },
      ),
    );
    expect(result.current.passwordRequest).not.toBeNull();
    expect(uploadCloudPlaylist).not.toHaveBeenCalled();

    await act(async () => result.current.passwordRequest!.onSuccess());
    expect(uploadCloudPlaylist).toHaveBeenCalled();
    expect(result.current.passwordRequest).toBeNull();
  });
});

describe('lead (dirigir en vivo)', () => {
  it('toma el mando directo si no hay sesión existente', async () => {
    const { result } = await mount();
    await act(async () => result.current.lead({ id: 'c1', name: 'Coro' }, null));
    await waitFor(() => expect(mockStartAsMaster).toHaveBeenCalled());
  });

  it('toma el mando directo si ya eres tú quien dirige (isSameLeader)', async () => {
    (isSameLeader as jest.Mock).mockReturnValue(true);
    const { result } = await mount();
    await act(async () =>
      result.current.lead({ id: 'c1', name: 'Coro' }, {
        master: { deviceId: 'device-1' },
      } as any),
    );
    await waitFor(() => expect(mockStartAsMaster).toHaveBeenCalled());
  });

  it('pide contraseña para quitarle el mando a otra persona', async () => {
    (isSameLeader as jest.Mock).mockReturnValue(false);
    const { result } = await mount();
    await act(async () =>
      result.current.lead({ id: 'c1', name: 'Coro' }, {
        master: { name: 'Otro Líder' },
      } as any),
    );
    expect(result.current.passwordRequest).not.toBeNull();
    expect(mockStartAsMaster).not.toHaveBeenCalled();

    await act(async () => result.current.passwordRequest!.onSuccess());
    expect(mockStartAsMaster).toHaveBeenCalled();
  });
});

describe('joinLive / leaveLive', () => {
  it('joinLive reemplaza con la playlist del líder y se une como oyente', async () => {
    const { result } = await mount();
    await act(async () =>
      result.current.joinLive(
        { id: 'c1', name: 'Coro' },
        { playlist: [song('e.cho')], master: { name: 'Líder' } } as any,
      ),
    );
    expect(mockReplaceAll).toHaveBeenCalledWith([song('e.cho')]);
    expect(mockJoinAsSlave).toHaveBeenCalledWith('c1');
  });

  it('leaveLive llama a choirSession.leave', async () => {
    const { result } = await mount();
    await act(async () => result.current.leaveLive());
    expect(mockLeave).toHaveBeenCalled();
  });
});

describe('dismissPassword', () => {
  it('limpia la solicitud de contraseña pendiente', async () => {
    (isSameLeader as jest.Mock).mockReturnValue(false);
    const { result } = await mount();
    await act(async () =>
      result.current.lead({ id: 'c1', name: 'Coro' }, {
        master: { name: 'Otro' },
      } as any),
    );
    expect(result.current.passwordRequest).not.toBeNull();
    await act(async () => result.current.dismissPassword());
    expect(result.current.passwordRequest).toBeNull();
  });
});

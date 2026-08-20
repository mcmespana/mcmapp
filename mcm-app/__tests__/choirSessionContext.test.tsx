/**
 * Tests de `ChoirSessionContext`: el estado cliente del "modo Coro"
 * (off/master/slave) que envuelve `services/choirSessionService` (ya
 * testeado aparte, aquí mockeado). Cubre lo que vive solo en el cliente y
 * que un test de servicio no puede ver: la persistencia del deviceId y de
 * la sesión en curso en AsyncStorage, que `session` solo cuente el remoto
 * si corresponde al código actual (no al anterior, a medio cambiar), el
 * auto-expulsado a 'off' cuando el líder borra la sesión, y que
 * publish/leave/changeCode respeten quién puede hacer qué (solo el líder).
 */
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createChoirSession,
  closeChoirSession,
  publishChoirCurrent,
  publishChoirPlaylist,
  subscribeChoirSession,
  changeChoirSessionCode,
} from '@/services/choirSessionService';
import {
  ChoirSessionProvider,
  useChoirSession,
} from '@/contexts/ChoirSessionContext';

jest.mock('@/services/choirSessionService', () => ({
  createChoirSession: jest.fn(() => Promise.resolve()),
  closeChoirSession: jest.fn(() => Promise.resolve()),
  publishChoirCurrent: jest.fn(() => Promise.resolve()),
  publishChoirPlaylist: jest.fn(() => Promise.resolve()),
  subscribeChoirSession: jest.fn(() => jest.fn()),
  changeChoirSessionCode: jest.fn(() => Promise.resolve()),
}));

const DEVICE_ID_KEY = '@mcm_device_id';
const SESSION_PERSIST_KEY = '@mcm_choir_session_v1';

let lastOnChange: ((s: any) => void) | null = null;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ChoirSessionProvider>{children}</ChoirSessionProvider>
);

async function mount() {
  const hook = await renderHook(() => useChoirSession(), { wrapper });
  await waitFor(() => expect(hook.result.current.deviceId).not.toBe(''));
  return hook;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  lastOnChange = null;
  (subscribeChoirSession as jest.Mock).mockImplementation(
    (_key: string, onChange: (s: any) => void) => {
      lastOnChange = onChange;
      return jest.fn();
    },
  );
});

describe('deviceId', () => {
  it('genera uno nuevo y lo persiste si no había ninguno guardado', async () => {
    const { result } = await mount();
    expect(result.current.deviceId).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
    expect(await AsyncStorage.getItem(DEVICE_ID_KEY)).toBe(
      result.current.deviceId,
    );
  });

  it('reutiliza el deviceId ya guardado', async () => {
    await AsyncStorage.setItem(DEVICE_ID_KEY, 'dispositivo-existente');
    const { result } = await mount();
    expect(result.current.deviceId).toBe('dispositivo-existente');
  });
});

describe('restaurar sesión persistida', () => {
  /**
   * BUG conocido, NO corregido aquí (regla de COBERTURA.md: no se toca
   * código de producción). El efecto que limpia AsyncStorage cuando
   * `mode === 'off'` corre ya en el PRIMER render, con el estado inicial —
   * y borra la clave `SESSION_PERSIST_KEY` antes de que el efecto de
   * restauración (que espera a que `deviceId` esté listo, un tick después)
   * llegue a leerla. Resultado real: una sesión guardada NUNCA se restaura
   * al reabrir la app. Este test fija el comportamiento ACTUAL (no el
   * deseado) para que salte si alguien lo cambia sin darse cuenta.
   */
  it('no restaura la sesión guardada al arrancar (bug de carrera con el efecto de limpieza)', async () => {
    await AsyncStorage.setItem(
      SESSION_PERSIST_KEY,
      JSON.stringify({ mode: 'slave', code: '1234' }),
    );
    const { result } = await mount();
    expect(result.current.mode).toBe('off');
    expect(result.current.code).toBeNull();
  });
});

describe('session (el remoto visible)', () => {
  it('es null hasta que Firebase responde para el código actual', async () => {
    const { result } = await mount();
    await act(async () => result.current.joinAsSlave('1234'));
    expect(result.current.session).toBeNull();
  });

  it('refleja el remoto una vez llega, para el código suscrito', async () => {
    const { result } = await mount();
    await act(async () => result.current.joinAsSlave('1234'));
    const remote = { v: 1, current: { filename: 'a.txt' } } as any;
    await act(async () => lastOnChange!(remote));
    expect(result.current.session).toEqual(remote);
  });

  it('si el líder borra la sesión (remoto null), vuelve a modo off', async () => {
    const { result } = await mount();
    await act(async () => result.current.joinAsSlave('1234'));
    await act(async () => lastOnChange!({ v: 1 } as any));
    expect(result.current.mode).toBe('slave');
    await act(async () => lastOnChange!(null));
    expect(result.current.mode).toBe('off');
    expect(result.current.code).toBeNull();
    expect(result.current.overrideTranspose).toBeNull();
  });
});

describe('startAsMaster / joinAsSlave', () => {
  it('startAsMaster crea la sesión remota y pasa a modo master', async () => {
    const { result } = await mount();
    const deviceId = result.current.deviceId;
    await act(async () =>
      result.current.startAsMaster('1234', [], { name: 'Ana' }),
    );
    expect(createChoirSession).toHaveBeenCalledWith(
      '1234',
      { deviceId, name: 'Ana' },
      [],
      { choirId: undefined, choirName: undefined },
    );
    expect(result.current.mode).toBe('master');
    expect(result.current.code).toBe('1234');
  });

  it('joinAsSlave activa modo slave sin comprobar antes que la sesión exista', async () => {
    const { result } = await mount();
    await act(async () => result.current.joinAsSlave('5678'));
    expect(result.current.mode).toBe('slave');
    expect(result.current.code).toBe('5678');
  });
});

describe('leave', () => {
  it('desde master cierra la sesión remota', async () => {
    const { result } = await mount();
    await act(async () => result.current.startAsMaster('1234', []));
    await act(async () => result.current.leave());
    expect(closeChoirSession).toHaveBeenCalledWith('1234');
    expect(result.current.mode).toBe('off');
    expect(result.current.code).toBeNull();
  });

  it('desde slave no intenta cerrar nada remoto (no es suyo)', async () => {
    const { result } = await mount();
    await act(async () => result.current.joinAsSlave('1234'));
    await act(async () => result.current.leave());
    expect(closeChoirSession).not.toHaveBeenCalled();
  });

  it('no revienta si closeChoirSession falla', async () => {
    (closeChoirSession as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    const { result } = await mount();
    await act(async () => result.current.startAsMaster('1234', []));
    await expect(
      act(async () => result.current.leave()),
    ).resolves.not.toThrow();
  });
});

describe('publishCurrent / publishPlaylist', () => {
  it('no publican si no eres el líder', async () => {
    const { result } = await mount();
    await act(async () => result.current.joinAsSlave('1234'));
    await act(async () =>
      result.current.publishCurrent({ filename: 'x', transpose: 0 }),
    );
    await act(async () => result.current.publishPlaylist([]));
    expect(publishChoirCurrent).not.toHaveBeenCalled();
    expect(publishChoirPlaylist).not.toHaveBeenCalled();
  });

  it('publican cuando eres el líder', async () => {
    const { result } = await mount();
    await act(async () => result.current.startAsMaster('1234', []));
    await act(async () =>
      result.current.publishCurrent({ filename: 'x', transpose: 2 }),
    );
    await act(async () => result.current.publishPlaylist([]));
    expect(publishChoirCurrent).toHaveBeenCalledWith('1234', {
      filename: 'x',
      transpose: 2,
    });
    expect(publishChoirPlaylist).toHaveBeenCalledWith('1234', []);
  });

  it('no revienta si el servicio falla al publicar', async () => {
    (publishChoirCurrent as jest.Mock).mockRejectedValueOnce(
      new Error('sin red'),
    );
    const { result } = await mount();
    await act(async () => result.current.startAsMaster('1234', []));
    await expect(
      act(async () =>
        result.current.publishCurrent({ filename: 'x', transpose: 0 }),
      ),
    ).resolves.not.toThrow();
  });
});

describe('changeCode', () => {
  it('lanza si no hay sesión activa', async () => {
    const { result } = await mount();
    await expect(result.current.changeCode('9999')).rejects.toThrow(
      /No hay sesión activa/,
    );
  });

  it('lanza si no eres el líder (eres slave)', async () => {
    const { result } = await mount();
    await act(async () => result.current.joinAsSlave('1234'));
    await expect(result.current.changeCode('9999')).rejects.toThrow(
      /Solo el líder/,
    );
  });

  it('cambia el código cuando eres el líder', async () => {
    const { result } = await mount();
    await act(async () => result.current.startAsMaster('1234', []));
    await act(async () => result.current.changeCode('5678'));
    expect(changeChoirSessionCode).toHaveBeenCalledWith('1234', '5678');
    expect(result.current.code).toBe('5678');
  });
});

describe('overrideTranspose', () => {
  it('setOverrideTranspose guarda el override local', async () => {
    const { result } = await mount();
    await act(async () => result.current.setOverrideTranspose(3));
    expect(result.current.overrideTranspose).toBe(3);
  });
});

describe('persistencia de la sesión en curso', () => {
  it('guarda mode + code al iniciar sesión', async () => {
    const { result } = await mount();
    await act(async () => result.current.startAsMaster('1234', []));
    await waitFor(async () => {
      const raw = await AsyncStorage.getItem(SESSION_PERSIST_KEY);
      expect(JSON.parse(raw!)).toEqual({ mode: 'master', code: '1234' });
    });
  });

  it('borra lo persistido al salir', async () => {
    const { result } = await mount();
    await act(async () => result.current.startAsMaster('1234', []));
    await act(async () => result.current.leave());
    await waitFor(async () => {
      expect(await AsyncStorage.getItem(SESSION_PERSIST_KEY)).toBeNull();
    });
  });
});

describe('fuera del provider (SSG)', () => {
  it('devuelve defaults sin reventar', async () => {
    const { result } = await renderHook(() => useChoirSession());
    expect(result.current.mode).toBe('off');
    expect(result.current.deviceId).toBe('');
    expect(result.current.session).toBeNull();
    expect(() => result.current.setOverrideTranspose(1)).not.toThrow();
    await expect(result.current.leave()).resolves.toBeUndefined();
  });
});

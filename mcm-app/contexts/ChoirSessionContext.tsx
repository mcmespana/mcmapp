/**
 * Estado global del "modo Coro". Tres modos:
 *
 *  - 'off'    → no hay sesión activa
 *  - 'master' → este dispositivo dirige (publica) los cambios
 *  - 'slave'  → este dispositivo sigue al maestro
 *
 * El maestro publica `current { filename, transpose }` y los esclavos lo
 * leen en tiempo real. Cada esclavo puede activar `overrideTranspose` para
 * ignorar el tono del maestro y usar el suyo localmente (sin afectar a la
 * sesión remota).
 */
import { logger } from '@/utils/logger';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ChoirCurrentSong,
  ChoirSession,
  closeChoirSession,
  createChoirSession,
  extendChoirSession,
  publishChoirCurrent,
  publishChoirPlaylist,
  shouldRenewChoirSession,
  subscribeChoirSession,
  changeChoirSessionCode,
} from '@/services/choirSessionService';
import type { SelectedSong } from '@/contexts/SelectedSongsContext';

export type ChoirMode = 'off' | 'master' | 'slave';

interface ChoirSessionContextValue {
  mode: ChoirMode;
  code: string | null;
  session: ChoirSession | null;
  /** Si el esclavo pulsa "usar mi tono", aquí se guarda su override local. */
  overrideTranspose: number | null;
  deviceId: string;

  startAsMaster: (
    code: string,
    playlist: SelectedSong[],
    opts?: { name?: string; choirId?: string; choirName?: string },
  ) => Promise<void>;
  joinAsSlave: (code: string) => Promise<void>;
  leave: () => Promise<void>;
  /** Solo maestro. Publica la canción actual. */
  publishCurrent: (
    current: Omit<ChoirCurrentSong, 'updatedAt'>,
  ) => Promise<void>;
  /** Solo maestro. Publica la playlist (al subir / reordenar). */
  publishPlaylist: (playlist: SelectedSong[]) => Promise<void>;
  /** Solo esclavo. Activa/desactiva su transpose local. */
  setOverrideTranspose: (semitones: number | null) => void;
  changeCode: (newCode: string) => Promise<void>;
}

const ChoirSessionContext = createContext<ChoirSessionContextValue | undefined>(
  undefined,
);

const DEVICE_ID_KEY = '@mcm_device_id';
const SESSION_PERSIST_KEY = '@mcm_choir_session_v1';

interface PersistedSession {
  mode: 'master' | 'slave';
  code: string;
}

function genDeviceId(): string {
  // Sin dependencias: combinación de timestamp + aleatorio.
  return (
    Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
  );
}

export const ChoirSessionProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [deviceId, setDeviceId] = useState<string>('');
  const [mode, setMode] = useState<ChoirMode>('off');
  const [code, setCode] = useState<string | null>(null);
  // Lo último recibido de Firebase, JUNTO al código al que pertenece: así, al
  // cambiar de sesión o salir, el valor viejo deja de contar solo y no hace
  // falta ponerlo a null a mano antes de resuscribirse.
  const [remote, setRemote] = useState<{
    code: string;
    session: ChoirSession | null;
  } | null>(null);
  const [overrideTranspose, setOverrideTranspose] = useState<number | null>(
    null,
  );
  // La sesión guardada solo se restaura UNA vez, al arrancar. Hasta que eso
  // termine (con o sin nada que restaurar), el efecto de abajo que limpia
  // AsyncStorage cuando `mode === 'off'` debe esperar: si no, borra la
  // sesión persistida —con el estado inicial 'off'— antes de que el efecto
  // de restauración (que espera a `deviceId`) llegue a leerla, y la sesión
  // guardada nunca se recupera al reabrir la app.
  const [restored, setRestored] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  // Cargar deviceId persistente.
  useEffect(() => {
    (async () => {
      try {
        let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (!id) {
          id = genDeviceId();
          await AsyncStorage.setItem(DEVICE_ID_KEY, id);
        }
        setDeviceId(id);
      } catch (e) {
        logger.error('deviceId persist error', e);
        setDeviceId(genDeviceId());
      }
    })();
  }, []);

  // Restaurar sesión guardada al iniciar.
  useEffect(() => {
    if (!deviceId) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SESSION_PERSIST_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as PersistedSession;
        if (
          parsed?.code &&
          (parsed.mode === 'master' || parsed.mode === 'slave')
        ) {
          setMode(parsed.mode);
          setCode(parsed.code);
        }
      } catch (e) {
        logger.error('choir session restore error', e);
      } finally {
        setRestored(true);
      }
    })();
  }, [deviceId]);

  // Persistir la sesión en cuanto cambia. Espera a que la restauración
  // inicial termine (ver `restored` arriba).
  useEffect(() => {
    if (!restored) return;
    if (mode === 'off' || !code) {
      AsyncStorage.removeItem(SESSION_PERSIST_KEY).catch(() => {});
      return;
    }
    const payload: PersistedSession = {
      mode: mode as 'master' | 'slave',
      code,
    };
    AsyncStorage.setItem(SESSION_PERSIST_KEY, JSON.stringify(payload)).catch(
      () => {},
    );
  }, [mode, code, restored]);

  // La sesión que ve la app: solo cuenta lo recibido para el código actual y
  // con una sesión activa. Cualquier otra cosa (acabamos de cambiar de código,
  // o hemos salido) es `null` sin esperar a la primera respuesta de Firebase.
  const session =
    code && mode !== 'off' && remote?.code === code ? remote.session : null;

  // Suscripción a Firebase mientras haya sesión activa.
  useEffect(() => {
    unsubRef.current?.();
    unsubRef.current = null;
    if (!code || mode === 'off') return;
    try {
      unsubRef.current = subscribeChoirSession(
        code,
        (s) => {
          setRemote({ code, session: s });
          if (!s) {
            // El maestro la borró → todos a 'off'.
            setMode('off');
            setCode(null);
            setOverrideTranspose(null);
          }
        },
        (err) => {
          logger.error('choir session subscribe error', err);
        },
      );
    } catch (e) {
      logger.error('choir subscribe error', e);
    }
    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [code, mode]);

  const startAsMaster = useCallback<ChoirSessionContextValue['startAsMaster']>(
    async (newCode, playlist, opts) => {
      await createChoirSession(
        newCode,
        { deviceId, name: opts?.name },
        playlist,
        { choirId: opts?.choirId, choirName: opts?.choirName },
      );
      setMode('master');
      setCode(newCode);
      setOverrideTranspose(null);
    },
    [deviceId],
  );

  const joinAsSlave = useCallback<ChoirSessionContextValue['joinAsSlave']>(
    async (newCode) => {
      // No verificamos existencia explícitamente: la suscripción se
      // encargará de avisar (session === null) y la UI lo manejará.
      setMode('slave');
      setCode(newCode);
      setOverrideTranspose(null);
    },
    [],
  );

  const leave = useCallback(async () => {
    const prevMode = mode;
    const prevCode = code;
    setMode('off');
    setCode(null);
    setOverrideTranspose(null);
    if (prevMode === 'master' && prevCode) {
      try {
        await closeChoirSession(prevCode);
      } catch (e) {
        logger.error('Error cerrando sesión coro', e);
      }
    }
  }, [mode, code]);

  // Si la sesión está a menos de 2 h de caducar, la actividad del líder
  // (publicar canción o playlist) la alarga 12 h más — ver
  // `shouldRenewChoirSession` en el servicio.
  const maybeRenewSession = useCallback(async () => {
    if (mode !== 'master' || !code) return;
    if (!shouldRenewChoirSession(session)) return;
    try {
      await extendChoirSession(code);
    } catch (e) {
      logger.error('extendChoirSession error', e);
    }
  }, [mode, code, session]);

  const publishCurrent = useCallback(
    async (current: Omit<ChoirCurrentSong, 'updatedAt'>) => {
      if (mode !== 'master' || !code) return;
      try {
        await publishChoirCurrent(code, current);
      } catch (e) {
        logger.error('publishCurrent error', e);
      }
      await maybeRenewSession();
    },
    [mode, code, maybeRenewSession],
  );

  const publishPlaylist = useCallback(
    async (playlist: SelectedSong[]) => {
      if (mode !== 'master' || !code) return;
      try {
        await publishChoirPlaylist(code, playlist);
      } catch (e) {
        logger.error('publishPlaylist error', e);
      }
      await maybeRenewSession();
    },
    [mode, code, maybeRenewSession],
  );

  const changeCode = useCallback(
    async (newCode: string) => {
      if (!code) throw new Error('No hay sesión activa');
      if (mode !== 'master') {
        throw new Error('Solo el líder puede cambiar el código');
      }
      await changeChoirSessionCode(code, newCode);
      setCode(newCode);
    },
    [code, mode],
  );

  const value = useMemo<ChoirSessionContextValue>(
    () => ({
      mode,
      code,
      session,
      overrideTranspose,
      deviceId,
      startAsMaster,
      joinAsSlave,
      leave,
      publishCurrent,
      publishPlaylist,
      setOverrideTranspose,
      changeCode,
    }),
    [
      mode,
      code,
      session,
      overrideTranspose,
      deviceId,
      startAsMaster,
      joinAsSlave,
      leave,
      publishCurrent,
      publishPlaylist,
      changeCode,
    ],
  );

  return (
    <ChoirSessionContext.Provider value={value}>
      {children}
    </ChoirSessionContext.Provider>
  );
};

export const useChoirSession = (): ChoirSessionContextValue => {
  const ctx = useContext(ChoirSessionContext);
  if (!ctx) {
    // SSG/SSR fallback — provider not mounted during static render.
    const noop = async () => {};
    return {
      mode: 'off',
      code: null,
      session: null,
      overrideTranspose: null,
      deviceId: '',
      startAsMaster: noop as any,
      joinAsSlave: noop as any,
      leave: noop,
      publishCurrent: noop,
      publishPlaylist: noop,
      setOverrideTranspose: () => {},
      changeCode: noop as any,
    };
  }
  return ctx;
};

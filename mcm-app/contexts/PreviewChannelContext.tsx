import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PREVIEW_CHANNEL,
  type FetchResult,
  type UnsupportedReason,
  applyChannel,
  fetchFromCurrentChannel,
  readChannelDiagnostics,
  restartApp,
  syncChannelOverride,
} from '@/services/previewChannel';
import { logger } from '@/utils/logger';

/**
 * Suscripción en caliente al canal `preview` de EAS Update ("modo tester").
 *
 * Este contexto es solo el estado: la mecánica real —y el porqué de cada
 * decisión— vive en `services/previewChannel.ts`.
 *
 * Dos fuentes de verdad, deliberadamente:
 *
 *   - **AsyncStorage** guarda la *intención* del usuario. Es lo que pinta la UI
 *     (la palanca, el "· alpha" del pie).
 *   - **El almacenamiento nativo de expo-updates** guarda el override real. Es
 *     lo que decide de qué canal bajan los updates, incluido el chequeo que la
 *     librería hace al arrancar antes de que corra nada de JS.
 *
 * En cada arranque reconciliamos las dos (`syncChannelOverride`), de forma que
 * un desajuste —flag encendido en un binario que aún no podía aplicarlo, u
 * override colgado tras apagar el flag— se autocura solo.
 */

const STORAGE_KEY = '@mcm_preview_channel_enabled';

/** Estado de la operación de cambio de canal, para que la UI pueda contarlo. */
export type PreviewChannelStatus =
  | { kind: 'idle' }
  | { kind: 'switching' }
  | { kind: 'ready' }
  | { kind: 'up-to-date' }
  | { kind: 'offline'; message: string }
  | { kind: 'unsupported'; reason: UnsupportedReason }
  | { kind: 'error'; message: string };

export interface ChannelDiagnostics {
  activeChannel: string | null;
  runtimeVersion: string | null;
  updateId: string | null;
  isEmbeddedLaunch: boolean;
}

interface PreviewChannelContextValue {
  /** ¿Quiere el usuario estar suscrito al canal preview? */
  enabled: boolean;
  /** Flag leído y override nativo reconciliado — listo para usarse. */
  hydrated: boolean;
  /** Resultado del último cambio de canal. */
  status: PreviewChannelStatus;
  /** `null` si este binario sí admite cambiar de canal en caliente. */
  unsupported: UnsupportedReason | null;
  /** Qué canal está sirviendo el bundle que corre AHORA MISMO. */
  diagnostics: ChannelDiagnostics;
  /** Cambia la suscripción y busca update en el canal nuevo. */
  setEnabled: (next: boolean) => Promise<void>;
  /** Reinicia la app para estrenar el bundle ya descargado. */
  restart: () => Promise<void>;
  openSecretMenu: () => void;
  closeSecretMenu: () => void;
  isSecretMenuOpen: boolean;
}

const EMPTY_DIAGNOSTICS: ChannelDiagnostics = {
  activeChannel: null,
  runtimeVersion: null,
  updateId: null,
  isEmbeddedLaunch: false,
};

const PreviewChannelContext = createContext<PreviewChannelContextValue>({
  enabled: false,
  hydrated: false,
  status: { kind: 'idle' },
  unsupported: null,
  diagnostics: EMPTY_DIAGNOSTICS,
  setEnabled: async () => {},
  restart: async () => {},
  openSecretMenu: () => {},
  closeSecretMenu: () => {},
  isSecretMenuOpen: false,
});

/** Traduce el resultado de la descarga al estado que consume la UI. */
function toStatus(result: FetchResult): PreviewChannelStatus {
  switch (result.kind) {
    case 'ready':
      return { kind: 'ready' };
    case 'up-to-date':
      return { kind: 'up-to-date' };
    case 'check-failed':
      return { kind: 'offline', message: result.message };
  }
}

export function PreviewChannelProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [enabled, setEnabledState] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<PreviewChannelStatus>({ kind: 'idle' });
  const [unsupported, setUnsupported] = useState<UnsupportedReason | null>(
    null,
  );
  const [diagnostics, setDiagnostics] =
    useState<ChannelDiagnostics>(EMPTY_DIAGNOSTICS);
  const [isSecretMenuOpen, setSecretMenuOpen] = useState(false);
  const switchingRef = useRef(false);

  // Arranque: leer el flag y dejar el override nativo alineado con él.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => v === '1')
      .catch(() => false)
      .then((active) => {
        if (cancelled) return;
        setEnabledState(active);
        // Se reconcilia SIEMPRE, también cuando el flag está apagado: así un
        // override heredado nunca deja a un usuario normal atrapado en preview.
        setUnsupported(syncChannelOverride(active));
        setDiagnostics(readChannelDiagnostics());
        setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setEnabled = useCallback(async (next: boolean) => {
    if (switchingRef.current) return;
    switchingRef.current = true;

    const previous = !next;
    // Optimista: la palanca se mueve ya, sin esperar a la red.
    setEnabledState(next);
    setStatus({ kind: 'switching' });

    try {
      const applied = applyChannel(next);
      if (!applied.ok) {
        // Ni siquiera se pudo aplicar el canal: revertir, porque si no la UI
        // diría "estás en alpha" mientras el dispositivo sigue en production.
        // Ese silencio es justo lo que hizo que el fallo pasara meses oculto.
        setEnabledState(previous);
        if (applied.kind === 'unsupported') {
          setUnsupported(applied.reason);
          setStatus({ kind: 'unsupported', reason: applied.reason });
        } else {
          setStatus({ kind: 'error', message: applied.message });
        }
        return;
      }

      // El canal ya es real y está persistido en nativo: guardamos el flag
      // AHORA, no después de la red. Si la app muriera durante la descarga,
      // el próximo arranque encontraría flag y override de acuerdo.
      await AsyncStorage.setItem(STORAGE_KEY, next ? '1' : '0').catch(() => {});

      setStatus(toStatus(await fetchFromCurrentChannel()));
      setDiagnostics(readChannelDiagnostics());
    } catch (err) {
      logger.warn(
        '[PreviewChannel] fallo inesperado al cambiar de canal:',
        err,
      );
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      switchingRef.current = false;
    }
  }, []);

  const restart = useCallback(async () => {
    try {
      await restartApp();
    } catch (err) {
      logger.warn('[PreviewChannel] no se pudo reiniciar:', err);
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  const openSecretMenu = useCallback(() => {
    setDiagnostics(readChannelDiagnostics());
    setSecretMenuOpen(true);
  }, []);
  const closeSecretMenu = useCallback(() => setSecretMenuOpen(false), []);

  const value = useMemo(
    () => ({
      enabled,
      hydrated,
      status,
      unsupported,
      diagnostics,
      setEnabled,
      restart,
      openSecretMenu,
      closeSecretMenu,
      isSecretMenuOpen,
    }),
    [
      enabled,
      hydrated,
      status,
      unsupported,
      diagnostics,
      setEnabled,
      restart,
      openSecretMenu,
      closeSecretMenu,
      isSecretMenuOpen,
    ],
  );

  return (
    <PreviewChannelContext.Provider value={value}>
      {children}
    </PreviewChannelContext.Provider>
  );
}

export function usePreviewChannel(): PreviewChannelContextValue {
  return useContext(PreviewChannelContext);
}

export { PREVIEW_CHANNEL };

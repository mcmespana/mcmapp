import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Updates from 'expo-updates';

/**
 * Resultado del hook de actualización OTA.
 *
 * Sigue el patrón recomendado por Expo:
 *   1. Comprueba si hay update en background al arrancar (y al volver del fondo).
 *   2. Lo descarga silenciosamente si existe (`fetchUpdateAsync`).
 *   3. Expone un estado limpio para que la UI pueda pedir al usuario que
 *      reinicie la app en el momento que prefiera.
 *
 * Referencia: https://docs.expo.dev/eas-update/runtime-behavior/
 */
export interface OTAUpdateState {
  /** El update ya está descargado y listo para aplicarse al reiniciar. */
  isReady: boolean;
  /** Hay un update detectado, descargando aún en background. */
  isDownloading: boolean;
  /** Hubo un fallo al comprobar/descargar (no bloqueante para el usuario). */
  error: Error | null;
  /** Aplica el update: descarga si hace falta y reinicia la app. */
  applyUpdate: () => Promise<void>;
}

const CHECK_DELAY_MS = 2500; // dar tiempo a que arranque la app antes de pedir red
const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 min periodic check

export default function useOTAUpdate(): OTAUpdateState {
  const [isReady, setIsReady] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const checkedRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const checkAndFetch = useCallback(async () => {
    // Updates.isEnabled es `false` en Expo Go y en dev clients sin canal OTA.
    if (__DEV__ || !Updates.isEnabled) return;
    if (Platform.OS === 'web') return;
    if (checkedRef.current) return;
    checkedRef.current = true;

    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) return;

      setIsDownloading(true);
      const fetched = await Updates.fetchUpdateAsync();
      setIsDownloading(false);
      if (fetched.isNew) {
        setIsReady(true);
      }
    } catch (err) {
      setIsDownloading(false);
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      checkAndFetch();
    }, CHECK_DELAY_MS);

    // Volver a comprobar cuando la app vuelve del background — el usuario
    // puede haber estado horas con la app en segundo plano.
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev.match(/inactive|background/) && next === 'active') {
        // Resetear el flag para permitir una nueva comprobación.
        checkedRef.current = false;
        checkAndFetch();
      }
    });

    // Comprobación periódica cada 15 minutos mientras la app está activa.
    const poll = setInterval(() => {
      checkedRef.current = false;
      checkAndFetch();
    }, POLL_INTERVAL_MS);

    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      sub.remove();
    };
  }, [checkAndFetch]);

  const applyUpdate = useCallback(async () => {
    try {
      // Si por alguna razón aún no se descargó (p.ej. el usuario abrió el
      // modal antes de que terminara el `fetchUpdateAsync`), lo forzamos.
      if (!isReady) {
        setIsDownloading(true);
        await Updates.fetchUpdateAsync();
        setIsDownloading(false);
      }
      await Updates.reloadAsync();
    } catch (err) {
      setIsDownloading(false);
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [isReady]);

  return { isReady, isDownloading, error, applyUpdate };
}

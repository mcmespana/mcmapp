import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import { isAppVersionSupported } from '@/utils/resolveProfileConfig';
import { openAppStore } from '@/utils/storeLinks';
import { logger } from '@/utils/logger';

interface VersionGateContextValue {
  /** La versión instalada ya no cumple `minAppVersion` de la config remota. */
  updateRequired: boolean;
  /** El usuario ha pulsado «Ahora no» en la pantalla de actualización obligatoria. */
  updateSkipped: boolean;
  /**
   * ¿Se le puede dejar pasar sin actualizar? Depende de `minAppVersionSkips`
   * (panel): `0` = estricto, `N` = N veces en total y luego estricto, ausente
   * = sin límite.
   */
  canSkip: boolean;
  /** Veces que aún se puede saltar. `null` = sin límite. */
  skipsLeft: number | null;
  /**
   * Deja pasar por esta sesión (se resetea al reabrir la app). Si hay límite,
   * gasta una de las oportunidades. No hace nada si ya no quedan.
   */
  skipUpdate: () => void;
  /** Abre la tienda correcta según la plataforma, sin preguntar. */
  openStore: () => void;
  currentVersion: string;
  minAppVersion: string;
}

const VersionGateContext = createContext<VersionGateContextValue>({
  updateRequired: false,
  updateSkipped: false,
  canSkip: true,
  skipsLeft: null,
  skipUpdate: () => {},
  openStore: () => {},
  currentVersion: '0.0.0',
  minAppVersion: '0.0.0',
});

/**
 * Contador de «Ahora no» gastados, por dispositivo. Va atado a la
 * `minAppVersion` que se estaba exigiendo: si el panel sube el mínimo, se trata
 * de una exigencia nueva y se empieza de cero.
 */
const SKIPS_KEY = 'versionGateSkips';

interface StoredSkips {
  forVersion: string;
  used: number;
}

async function readSkipsUsed(minAppVersion: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(SKIPS_KEY);
    if (!raw) return 0;
    const stored = JSON.parse(raw) as Partial<StoredSkips>;
    if (stored.forVersion !== minAppVersion) return 0;
    return typeof stored.used === 'number' && stored.used > 0
      ? Math.floor(stored.used)
      : 0;
  } catch (e) {
    logger.warn('No se pudo leer el contador de saltos de actualización', e);
    return 0;
  }
}

export function VersionGateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const resolved = useResolvedProfileConfig();
  const [updateSkipped, setUpdateSkipped] = useState(false);
  // `null` = aún sin leer del disco.
  const [skipsUsed, setSkipsUsed] = useState<number | null>(null);

  const currentVersion = String(Constants.expoConfig?.version ?? '0.0.0');
  const minAppVersion = resolved.minAppVersion;
  const skipLimit = resolved.minAppVersionSkips ?? null;
  const updateRequired = useMemo(
    () => !isAppVersionSupported(currentVersion, minAppVersion),
    [currentVersion, minAppVersion],
  );

  // Solo hace falta el contador cuando hay algo que bloquear Y límite de saltos.
  const needsCounter = updateRequired && skipLimit !== null;
  useEffect(() => {
    if (!needsCounter) return;
    let alive = true;
    readSkipsUsed(minAppVersion).then((used) => {
      if (alive) setSkipsUsed(used);
    });
    return () => {
      alive = false;
    };
  }, [needsCounter, minAppVersion]);

  const skipsLeft =
    skipLimit === null
      ? null
      : skipsUsed === null
        ? 0 // sin leer todavía: no se ofrece el botón hasta saberlo
        : Math.max(0, skipLimit - skipsUsed);
  const canSkip = skipsLeft === null || skipsLeft > 0;

  const skipUpdate = useCallback(() => {
    if (!canSkip) return;
    setUpdateSkipped(true);
    if (skipLimit === null || skipsUsed === null) return;
    const used = skipsUsed + 1;
    setSkipsUsed(used);
    const stored: StoredSkips = { forVersion: minAppVersion, used };
    AsyncStorage.setItem(SKIPS_KEY, JSON.stringify(stored)).catch((e) =>
      logger.warn('No se pudo guardar el contador de saltos', e),
    );
  }, [canSkip, skipLimit, skipsUsed, minAppVersion]);

  const value = useMemo<VersionGateContextValue>(
    () => ({
      updateRequired,
      updateSkipped,
      canSkip,
      skipsLeft,
      skipUpdate,
      openStore: () => {
        openAppStore();
      },
      currentVersion,
      minAppVersion,
    }),
    [
      updateRequired,
      updateSkipped,
      canSkip,
      skipsLeft,
      skipUpdate,
      currentVersion,
      minAppVersion,
    ],
  );

  return (
    <VersionGateContext.Provider value={value}>
      {children}
    </VersionGateContext.Provider>
  );
}

export function useVersionGate(): VersionGateContextValue {
  return useContext(VersionGateContext);
}

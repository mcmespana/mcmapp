import React, { createContext, useContext, useMemo, useState } from 'react';
import Constants from 'expo-constants';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import { isAppVersionSupported } from '@/utils/resolveProfileConfig';
import { openAppStore } from '@/utils/storeLinks';

interface VersionGateContextValue {
  /** La versión instalada ya no cumple `minAppVersion` de la config remota. */
  updateRequired: boolean;
  /** El usuario ha pulsado "Voy pa'dentro" en la pantalla de actualización obligatoria. */
  updateSkipped: boolean;
  /** Marca el update como saltado por esta sesión (se resetea al reabrir la app). */
  skipUpdate: () => void;
  /** Abre la tienda correcta según la plataforma, sin preguntar. */
  openStore: () => void;
  currentVersion: string;
  minAppVersion: string;
}

const VersionGateContext = createContext<VersionGateContextValue>({
  updateRequired: false,
  updateSkipped: false,
  skipUpdate: () => {},
  openStore: () => {},
  currentVersion: '0.0.0',
  minAppVersion: '0.0.0',
});

export function VersionGateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const resolved = useResolvedProfileConfig();
  const [updateSkipped, setUpdateSkipped] = useState(false);

  const currentVersion = String(Constants.expoConfig?.version ?? '0.0.0');
  const updateRequired = useMemo(
    () => !isAppVersionSupported(currentVersion, resolved.minAppVersion),
    [currentVersion, resolved.minAppVersion],
  );

  const value = useMemo<VersionGateContextValue>(
    () => ({
      updateRequired,
      updateSkipped,
      skipUpdate: () => setUpdateSkipped(true),
      openStore: () => {
        openAppStore();
      },
      currentVersion,
      minAppVersion: resolved.minAppVersion,
    }),
    [updateRequired, updateSkipped, currentVersion, resolved.minAppVersion],
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

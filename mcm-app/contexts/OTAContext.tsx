import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useOTAUpdate from '@/hooks/useOTAUpdate';
import { usePreviewChannel } from '@/contexts/PreviewChannelContext';
import OTAUpdatingOverlay from '@/components/OTAUpdatingOverlay';
import {
  LAST_AUTO_APPLY_KEY,
  shouldAutoApply,
  type AutoApplyTrigger,
} from '@/utils/otaAutoApply';

interface OTAContextValue {
  /** Hay una OTA descargada, lista para aplicarse. */
  isReady: boolean;
  isDownloading: boolean;
  error: Error | null;
  /** Aplica ya la OTA descargada, con la pantalla de «un momentín». */
  applyUpdate: () => Promise<void>;
  /** La app se está actualizando (la pantalla de «un momentín» está puesta). */
  applying: boolean;
}

const OTAContext = createContext<OTAContextValue>({
  isReady: false,
  isDownloading: false,
  error: null,
  applyUpdate: async () => {},
  applying: false,
});

/**
 * Mínimo que se ve la pantalla de «un momentín» antes de recargar: la OTA ya
 * está descargada y la recarga es casi instantánea, y sin esto la frase no
 * daría tiempo ni a leerse.
 */
export const MIN_OVERLAY_MS = 2800;
/** Si pasado esto la app sigue viva, la recarga ha fallado: se quita la pantalla. */
export const RELOAD_GRACE_MS = 4000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function readLastAutoApply(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_AUTO_APPLY_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * Comprueba y descarga las OTA en segundo plano (`useOTAUpdate`) y, cuando hay
 * una lista, la APLICA SOLA en el momento menos molesto (`utils/otaAutoApply`):
 * recién abierta la app, o al volver a ella desde el fondo. Nunca a media
 * pantalla: si llega con la app en uso, espera a la próxima vuelta.
 */
export function OTAProvider({ children }: { children: React.ReactNode }) {
  // `OTAProvider` va DENTRO de `PreviewChannelProvider` (ver `app/_layout.tsx`):
  // no buscamos updates hasta que el canal esté reconciliado, para que un
  // tester en modo alpha no acabe pidiéndole el update a `production` por
  // ganarle la carrera al override.
  const { hydrated } = usePreviewChannel();
  const ota = useOTAUpdate({ ready: hydrated });
  const [applying, setApplying] = useState(false);
  const applyingRef = useRef(false);
  // Cuándo la app se hizo activa por última vez (arranque o vuelta del fondo).
  // Se inicia en un efecto y no en el render: `Date.now()` no es puro.
  const activeSinceRef = useRef<number | null>(null);
  const appStateRef = useRef<AppStateStatus>(
    (AppState.currentState ?? 'active') as AppStateStatus,
  );

  const { isReady, applyUpdate: applyOta } = ota;

  const applyUpdate = useCallback(async () => {
    if (applyingRef.current) return;
    applyingRef.current = true;
    setApplying(true);
    await sleep(MIN_OVERLAY_MS);
    // `applyOta` recarga la app: si todo va bien, de aquí no se vuelve.
    await applyOta();
    await sleep(RELOAD_GRACE_MS);
    applyingRef.current = false;
    setApplying(false);
  }, [applyOta]);

  const tryAutoApply = useCallback(
    async (trigger: AutoApplyTrigger) => {
      if (applyingRef.current) return;
      const lastAutoApplyAt = await readLastAutoApply();
      const now = Date.now();
      if (
        !shouldAutoApply({
          trigger,
          now,
          activeSince: activeSinceRef.current ?? now,
          lastAutoApplyAt,
        })
      ) {
        return;
      }
      // La marca se guarda ANTES de recargar: es el cortafuegos contra un
      // bucle de recargas si la OTA no llega a arrancar.
      try {
        await AsyncStorage.setItem(LAST_AUTO_APPLY_KEY, String(now));
      } catch {
        // Sin disco no hay cortafuegos, pero tampoco hay por qué no actualizar.
      }
      await applyUpdate();
    },
    [applyUpdate],
  );

  useEffect(() => {
    activeSinceRef.current ??= Date.now();
  }, []);

  // Update recién listo → si la app está recién abierta, se aplica.
  useEffect(() => {
    if (isReady) void tryAutoApply('ready');
  }, [isReady, tryAutoApply]);

  // Vuelta del fondo → se reinicia el «recién abierta» y, con un update ya
  // esperando, se aplica.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev === 'background' && next === 'active') {
        activeSinceRef.current = Date.now();
        if (isReady) void tryAutoApply('foreground');
      }
    });
    return () => sub.remove();
  }, [isReady, tryAutoApply]);

  return (
    <OTAContext.Provider
      value={{
        isReady: ota.isReady,
        isDownloading: ota.isDownloading,
        error: ota.error,
        applyUpdate,
        applying,
      }}
    >
      {children}
      {/* Aquí y no en el layout: tiene que verse también si la app está tapada
          por la pantalla de mantenimiento o de actualización obligatoria. */}
      <OTAUpdatingOverlay visible={applying} />
    </OTAContext.Provider>
  );
}

export function useOTAContext(): OTAContextValue {
  return useContext(OTAContext);
}

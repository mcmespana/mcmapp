import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

/**
 * Activa o desactiva el canal "preview" de EAS Update en tiempo de ejecución,
 * sin tener que distribuir un binario aparte. Vive como un flag persistido en
 * AsyncStorage. Al arrancar la app, si el flag está activo, se aplica el
 * override de URL+headers de `expo-updates` para que el próximo `checkForUpdate`
 * pida bundles publicados en la branch `preview` de EAS Update.
 *
 * El override es **inocuo** mientras `runtimeVersion` del binario coincida con
 * la del bundle preview. Si divergen, EAS simplemente no entrega nada y la app
 * sigue funcionando con su bundle actual. Reversible: al desactivar el flag y
 * reiniciar, la app vuelve a su canal nativo (`production`).
 */

const STORAGE_KEY = '@mcm_preview_channel_enabled';
const PREVIEW_CHANNEL = 'preview';

interface PreviewChannelContextValue {
  /** ¿Está el dispositivo suscrito al canal preview? */
  enabled: boolean;
  /** Persistido y override aplicados — listo para usarse. */
  hydrated: boolean;
  /** Cambiar la suscripción. Para que tenga efecto, reiniciar la app. */
  setEnabled: (next: boolean) => Promise<void>;
  /** Modal espectacular para activar/desactivar. */
  openSecretMenu: () => void;
  closeSecretMenu: () => void;
  isSecretMenuOpen: boolean;
}

const PreviewChannelContext = createContext<PreviewChannelContextValue>({
  enabled: false,
  hydrated: false,
  setEnabled: async () => {},
  openSecretMenu: () => {},
  closeSecretMenu: () => {},
  isSecretMenuOpen: false,
});

function readUpdateUrl(): string | null {
  // Preferimos la URL del manifest que está embebida en el binario. En dev/web
  // suele ser `undefined`, y entonces no aplicamos override (no haría nada).
  const url =
    (Constants.expoConfig as { updates?: { url?: string } } | null)?.updates
      ?.url ??
    (
      Constants.manifest2 as {
        extra?: { expoClient?: { updates?: { url?: string } } };
      } | null
    )?.extra?.expoClient?.updates?.url ??
    null;
  return typeof url === 'string' && url.length > 0 ? url : null;
}

function applyPreviewOverride(active: boolean) {
  if (Platform.OS === 'web') return;
  if (__DEV__) return; // dev client: el override no hace nada útil
  try {
    if (!active) {
      Updates.setUpdateURLAndRequestHeadersOverride(null);
      return;
    }
    const updateUrl = readUpdateUrl();
    if (!updateUrl) return;
    Updates.setUpdateURLAndRequestHeadersOverride({
      updateUrl,
      requestHeaders: { 'expo-channel-name': PREVIEW_CHANNEL },
    });
  } catch {
    // No bloqueante: si el override falla, la app sigue en su canal nativo.
  }
}

export function PreviewChannelProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [enabled, setEnabledState] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [isSecretMenuOpen, setSecretMenuOpen] = useState(false);
  const overrideAppliedRef = useRef(false);

  // Hidratar el flag y aplicar override en el primer arranque.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (cancelled) return;
        const active = v === '1';
        setEnabledState(active);
        if (active && !overrideAppliedRef.current) {
          applyPreviewOverride(true);
          overrideAppliedRef.current = true;
        }
        setHydrated(true);
      })
      .catch(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setEnabled = useCallback(async (next: boolean) => {
    setEnabledState(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      // ignore — el estado en memoria es la fuente principal durante la sesión
    }
    applyPreviewOverride(next);
    overrideAppliedRef.current = next;
  }, []);

  const openSecretMenu = useCallback(() => setSecretMenuOpen(true), []);
  const closeSecretMenu = useCallback(() => setSecretMenuOpen(false), []);

  const value = useMemo(
    () => ({
      enabled,
      hydrated,
      setEnabled,
      openSecretMenu,
      closeSecretMenu,
      isSecretMenuOpen,
    }),
    [
      enabled,
      hydrated,
      setEnabled,
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

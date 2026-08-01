// hooks/useComunicaWebView.ts
// Toda la mecánica del WebView de Comunica que no es maquetación: tema hacia la
// web, historial atrás/adelante, progreso de carga y estado de error/reintento.
// La pantalla (`app/screens/ComunicaScreen.tsx`) se queda solo con el layout.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router/react-navigation';
import type { WebView, WebViewNavigation } from 'react-native-webview';
import type { WebViewProgressEvent } from 'react-native-webview/lib/WebViewTypes';
import { useToast } from '@/contexts/AppToastContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAppSettings } from '@/contexts/AppSettingsContext';

export const COMUNICA_URL =
  'https://comunica.movimientoconsolacion.com/aptest/?app=1';

/**
 * Propaga el tema de la app (claro/oscuro) a la web embebida. Se manda por
 * TRES vías complementarias, todas inofensivas si la web todavía las ignora:
 *
 *   1. `?theme=` en la URL inicial → PHP puede renderizar ya en oscuro en la
 *      primerísima petición, sin parpadeo.
 *   2. Cookie `mcm_theme` (1 año, path=/) → viaja en TODAS las peticiones
 *      siguientes, así que PHP la lee aunque el usuario navegue por el portal.
 *   3. Atributo/clase en `<html>` + `color-scheme` → sirve a webs que resuelven
 *      el tema solo con CSS, sin tocar el servidor.
 *
 * Se reinyecta en cada carga de página y también en caliente si el usuario
 * cambia el tema mientras está en la pantalla (sin recargar, para no perder
 * lo que tenga escrito en un formulario).
 *
 * `<meta name="theme-color">` se actualiza también: algunos navegadores
 * embebidos lo usan para pintar la costura superior/inferior del scroll.
 */
export const themeBridgeJS = (theme: 'light' | 'dark', pageBg: string) =>
  `(function(){try{
  var t=${JSON.stringify(theme)};
  var bg=${JSON.stringify(pageBg)};
  var r=document.documentElement;
  r.dataset.mcmTheme=t;
  r.classList.toggle('dark', t==='dark');
  r.classList.toggle('light', t!=='dark');
  r.style.colorScheme=t;
  var m=document.querySelector('meta[name="theme-color"]');
  if(!m){m=document.createElement('meta');m.setAttribute('name','theme-color');document.head.appendChild(m);}
  m.setAttribute('content',bg);
  document.cookie='mcm_theme='+t+';path=/;max-age=31536000;samesite=Lax';
}catch(e){}})();true;`;

type Status = 'loading' | 'ready' | 'error';

export function useComunicaWebView(pageBg: string) {
  const scheme = useColorScheme() ?? 'light';
  const { loading: settingsLoading } = useAppSettings();
  const { toast } = useToast();
  const webViewRef = useRef<WebView>(null);

  // ── Historial de la web (atrás/adelante) ──────────────────────────────────
  const [nav, setNav] = useState({ canGoBack: false, canGoForward: false });
  const onNavigationStateChange = useCallback((s: WebViewNavigation) => {
    setNav({ canGoBack: s.canGoBack, canGoForward: s.canGoForward });
  }, []);
  const goBack = useCallback(() => webViewRef.current?.goBack(), []);
  const goForward = useCallback(() => webViewRef.current?.goForward(), []);

  // Android: el botón/gesto atrás del sistema navega primero por el historial
  // de la web; solo sale de la pantalla cuando ya no hay a dónde volver.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (nav.canGoBack) {
          webViewRef.current?.goBack();
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [nav.canGoBack]),
  );

  // ── Tema hacia la web ─────────────────────────────────────────────────────
  // La URL se congela con el PRIMER tema válido: si dependiera de `scheme`, un
  // cambio de tema mutaría `source.uri` y RECARGARÍA la web, perdiendo lo que
  // el usuario tuviera escrito. Los cambios en caliente van por injectJavaScript.
  //
  // «Válido» = después de que AppSettings haya leído AsyncStorage. Antes de eso
  // el tema guardado todavía no se conoce y `scheme` cae al del sistema
  // operativo; congelarlo ahí mandaría `?theme=dark` a alguien que tiene la app
  // en Claro con el móvil en oscuro (parpadeo del tema equivocado al entrar).
  const latchedTheme = useRef<'light' | 'dark' | null>(null);
  if (latchedTheme.current === null && !settingsLoading) {
    latchedTheme.current = scheme;
  }
  const initialTheme = latchedTheme.current;
  const sourceUri = useMemo(
    () => (initialTheme ? `${COMUNICA_URL}&theme=${initialTheme}` : null),
    [initialTheme],
  );
  const themeJS = useMemo(
    () => themeBridgeJS(scheme, pageBg),
    [scheme, pageBg],
  );

  useEffect(() => {
    webViewRef.current?.injectJavaScript(themeJS);
  }, [themeJS]);

  // ── Carga: progreso, primera carga y errores ──────────────────────────────
  const [status, setStatus] = useState<Status>('loading');
  const [progress, setProgress] = useState(0);
  // Navegación posterior a la primera carga (enlace dentro del portal): no se
  // tapa la pantalla, solo se muestra el hilo de progreso de arriba.
  const [pageLoading, setPageLoading] = useState(false);

  const onLoadStart = useCallback(() => {
    setProgress(0.02);
    setPageLoading(true);
  }, []);

  const onLoadProgress = useCallback((e: WebViewProgressEvent) => {
    setProgress(e.nativeEvent.progress);
  }, []);

  // Se pone a true en cuanto una carga termina bien: a partir de ahí los
  // errores son de una navegación concreta, no del arranque de la pantalla.
  const hasLoadedOk = useRef(false);
  const failedRef = useRef(false);

  const onLoadEnd = useCallback(() => {
    setProgress(1);
    setPageLoading(false);
    if (failedRef.current) return; // el error manda: no destapamos la web rota
    hasLoadedOk.current = true;
    // Reinyecta el tema por si esta carga no aplicó `injectedJavaScript`
    // (redirecciones, back/forward cache): es idempotente y baratísimo.
    webViewRef.current?.injectJavaScript(themeJS);
    setStatus('ready');
  }, [themeJS]);

  const onError = useCallback(
    // Sirve tanto para `onError` como para `onHttpError` (tipos distintos en
    // react-native-webview): no usamos el evento, solo el hecho de que falló.
    () => {
      setPageLoading(false);
      if (!hasLoadedOk.current) {
        failedRef.current = true;
        setStatus('error');
        return;
      }
      // Si ya había contenido en pantalla, un toast molesta menos que taparlo.
      toast.show({
        variant: 'danger',
        label: 'No hemos podido cargar esa página de Comunica.',
        actionLabel: 'Cerrar',
        onActionPress: ({ hide }) => hide(),
      });
    },
    [toast],
  );

  const retry = useCallback(() => {
    failedRef.current = false;
    setProgress(0);
    setStatus('loading');
    webViewRef.current?.reload();
  }, []);

  return {
    scheme,
    webViewRef,
    sourceUri,
    themeJS,
    nav,
    onNavigationStateChange,
    goBack,
    goForward,
    status,
    progress,
    pageLoading,
    onLoadStart,
    onLoadProgress,
    onLoadEnd,
    onError,
    retry,
  };
}

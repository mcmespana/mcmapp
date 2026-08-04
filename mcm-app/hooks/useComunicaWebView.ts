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
import {
  COMUNICA_BASE_URL,
  consumePendingComunicaAuthUrl,
  subscribeComunicaAuthUrl,
} from '@/utils/pendingComunicaLink';

export const COMUNICA_URL = `${COMUNICA_BASE_URL}?app=1`;

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

/**
 * Reserva dentro de la PÁGINA el hueco del notch y el de la barra de pestañas
 * flotante, para las plataformas donde el WebView no sabe hacerlo solo.
 *
 * iOS lo resuelve con `contentInset` (el scroller nativo se desplaza y el
 * contenido se desliza por debajo de la barra glass). **El WebView de Android
 * no admite `contentInset`**: si se superpone la franja del notch, el principio
 * de la página queda tapado para siempre. La única forma de conseguir el mismo
 * efecto es que la propia página reserve el espacio, así que se lo inyectamos.
 *
 * Se publican siempre dos variables CSS —`--mcm-app-inset-top` y
 * `--mcm-app-inset-bottom`— para que la web pueda usarlas en sus elementos
 * `position: fixed`, que ningún inset del contenedor mueve (ver el contrato).
 * El `padding` sobre `<body>` solo se aplica donde hace falta (`applyPadding`).
 *
 * **Opt-out**: si la web declara `data-mcm-insets="self"` en `<html>`, se le
 * dejan las variables y no se le toca el layout — reserva ella el hueco.
 *
 * Es idempotente: reutiliza siempre el mismo `<style>`, así que reinyectarlo en
 * cada carga y en cada rotación no acumula padding.
 */
export const safeAreaBridgeJS = ({
  top,
  bottom,
  widthDp,
  applyPadding,
}: {
  /** Alto de la safe area superior, en dp. */
  top: number;
  /** Hueco a reservar al final de la página, en dp. */
  bottom: number;
  /** Ancho del WebView en dp, para convertir dp → px CSS. */
  widthDp: number;
  /** Si además del `padding` hay que mover el `<body>`. */
  applyPadding: boolean;
}) =>
  `(function(){try{
  var TOP=${JSON.stringify(top)},BOT=${JSON.stringify(bottom)};
  var W=${JSON.stringify(widthDp)},APPLY=${applyPadding ? 'true' : 'false'};
  var r=document.documentElement;
  // dp → px CSS. Con el viewport habitual (\`width=device-width\`) 1dp es 1px
  // CSS, pero si la web declarara un ancho fijo dejaría de serlo: \`innerWidth\`
  // mide el viewport REAL en px CSS, así que la proporción lo corrige.
  var s=(W>0&&window.innerWidth>0)?window.innerWidth/W:1;
  if(!isFinite(s)||s<=0.2||s>5)s=1;
  r.style.setProperty('--mcm-app-inset-top',Math.round(TOP*s)+'px');
  r.style.setProperty('--mcm-app-inset-bottom',Math.round(BOT*s)+'px');
  var el=document.getElementById('mcm-app-safe-area');
  if(!APPLY||r.getAttribute('data-mcm-insets')==='self'){if(el)el.remove();return;}
  if(!el){el=document.createElement('style');el.id='mcm-app-safe-area';(document.head||r).appendChild(el);}
  el.textContent='body{padding-top:var(--mcm-app-inset-top)!important;padding-bottom:var(--mcm-app-inset-bottom)!important;}html{scroll-padding-top:var(--mcm-app-inset-top);scroll-padding-bottom:var(--mcm-app-inset-bottom);}';
}catch(e){}})();true;`;

type Status = 'loading' | 'ready' | 'error';

export function useComunicaWebView(pageBg: string, safeAreaJS = '') {
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

  // Enlace de acceso llegado por deep link desde el correo (ver
  // `utils/pendingComunicaLink.ts`). Manda sobre la URL normal: es justo lo que
  // la persona ha pedido al pulsar el botón del email. Cambiarlo RECARGA el
  // WebView a propósito — es la única forma de que WordPress vea el token.
  const [authUrl, setAuthUrl] = useState<string | null>(
    consumePendingComunicaAuthUrl,
  );
  useEffect(() => subscribeComunicaAuthUrl(setAuthUrl), []);

  const sourceUri = useMemo(
    () =>
      initialTheme ? `${authUrl ?? COMUNICA_URL}&theme=${initialTheme}` : null,
    [initialTheme, authUrl],
  );
  const themeJS = useMemo(
    () => themeBridgeJS(scheme, pageBg),
    [scheme, pageBg],
  );

  // Todo lo que la app le mete a la web, junto. Va como `injectedJavaScript`
  // (se ejecuta en CADA carga de página) y además se reinyecta en caliente
  // cuando cambia algo: el tema, o los insets al rotar la pantalla. Los dos
  // trozos son idempotentes, así que repetirlos no acumula nada.
  const injectedJS = useMemo(() => themeJS + safeAreaJS, [themeJS, safeAreaJS]);

  useEffect(() => {
    webViewRef.current?.injectJavaScript(injectedJS);
  }, [injectedJS]);

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
    // Reinyecta tema e insets por si esta carga no aplicó `injectedJavaScript`
    // (redirecciones, back/forward cache): es idempotente y baratísimo.
    webViewRef.current?.injectJavaScript(injectedJS);
    setStatus('ready');
  }, [injectedJS]);

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
    injectedJS,
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

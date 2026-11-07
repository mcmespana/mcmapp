import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { Spinner } from 'heroui-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import type { SongStyleState } from '@/hooks/useSongProcessor';
import { themeColors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
import {
  makeKeydownForwarder,
  nextSongView,
  swapBodyScript,
  type SongView,
} from '@/utils/songDisplayBridge';

interface SongDisplayProps {
  songHtml: string;
  isLoading: boolean;
  /**
   * Live style snapshot. Changes are pushed into the WebView via
   * `postMessage` / `injectJavaScript`, avoiding the full HTML reload that
   * caused the previous 200–500ms flicker on every settings tweak.
   */
  styleState?: SongStyleState;
  /**
   * Mensajes que la página (HTML/WebView) envía a RN. Usado en modo admin para
   * el long-press de arreglos (`{ type: 'arr-longpress', line }`).
   */
  onMessage?: (data: any) => void;
  /**
   * Letra a pantalla completa (sin tarjeta con márgenes): ocupa todo el ancho,
   * sin borde redondeado ni sombra. Usado en el detalle de canción para que la
   * letra scrollee bajo el header transparente (efecto glass, como categorías).
   */
  fullBleed?: boolean;
  /**
   * Inset superior del scroll (iOS): la letra empieza por debajo del header
   * transparente pero scrollea por debajo de él. Solo aplica con `fullBleed`.
   */
  topInset?: number;
  /**
   * Selector CSS de la parte de la hoja que hay que enseñar (se desplaza
   * hasta ella al cambiar y al cargar). `null` = arriba del todo. Lo usa el
   * onboarding del cantoral para enseñar el estribillo al elegir su estilo.
   */
  scrollTo?: string | null;
  /**
   * Qué documento es (el `filename` de la canción). Mientras no cambie, un
   * HTML nuevo con la misma carcasa —transponer, cambiar la notación— se pinta
   * DENTRO de la página ya cargada, sin recargarla: sin parpadeo y sin volver
   * arriba (`utils/songDisplayBridge.ts`). Sin `docKey`, cada HTML nuevo
   * recarga, como siempre.
   */
  docKey?: string;
}

/**
 * Lleva la hoja hasta `selector` (o arriba del todo con `null`). Sin
 * `selector` (undefined) no hace nada: casi nadie lo pide.
 */
function runScroll(
  selector: string | null | undefined,
  webView: WebView | null,
  iframe: HTMLIFrameElement | null,
) {
  if (selector === undefined) return;
  const js = scrollScript(selector);
  if (iframe) {
    try {
      // srcDoc hereda el origen: el documento del iframe es accesible.
      (iframe.contentWindow as any)?.eval(js);
    } catch {
      /* noop */
    }
  } else {
    webView?.injectJavaScript(js);
  }
}

/** JS que lleva la hoja hasta `selector` (o arriba del todo). */
function scrollScript(selector: string | null): string {
  return `(function(){setTimeout(function(){var e=${JSON.stringify(
    selector,
  )};var el=e&&document.querySelector(e);if(el){el.scrollIntoView({block:'start',behavior:'smooth'});}else{window.scrollTo({top:0,behavior:'smooth'});}},150);true;})();`;
}

const SongDisplay: React.FC<SongDisplayProps> = ({
  songHtml,
  isLoading,
  styleState,
  onMessage,
  fullBleed = false,
  topInset = 0,
  scrollTo,
  docKey,
}) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const layout = useResponsiveLayout();
  const webViewRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Tracks whether the document is loaded so we can flush queued style updates.
  const readyRef = useRef(false);
  // Latest style we tried to apply (to re-flush on (re)load).
  const pendingStyleRef = useRef<SongStyleState | undefined>(styleState);
  pendingStyleRef.current = styleState;
  // Latest onMessage in a ref so the web listener stays stable.
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  // Parse a raw message string coming from the page and relay it.
  const handleRawMessage = (raw: string) => {
    if (!onMessageRef.current || !raw) return;
    try {
      onMessageRef.current(JSON.parse(raw));
    } catch {
      /* ignore non-JSON messages */
    }
  };

  // Lo que la página tiene cargado (`loaded`, lo que va en `source`/`srcDoc`)
  // y lo que enseña (`shown`). Difieren cuando un HTML nuevo se ha pintado
  // dentro de la página sin recargarla; `swaps` cuenta esos cambios para que
  // el efecto de abajo los mande. Se ajusta durante el render (el patrón de
  // React para "cambiar estado cuando cambia una prop").
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<SongView>({
    loaded: songHtml,
    key: docKey,
    shown: songHtml,
    swaps: 0,
  });
  const { view: nextView, ready: nextReady } = nextSongView(view, ready, {
    html: songHtml,
    docKey,
    isLoading,
  });
  if (nextView !== view) setView(nextView);
  if (nextReady !== ready) setReady(nextReady);

  // Pinta el HTML nuevo dentro de la página ya cargada.
  useEffect(() => {
    if (view.swaps === 0) return;
    const js = swapBodyScript(view.shown);
    if (Platform.OS === 'web') {
      try {
        // srcDoc hereda el origen: el documento del iframe es accesible.
        (iframeRef.current?.contentWindow as any)?.eval(js);
      } catch {
        /* noop */
      }
    } else {
      webViewRef.current?.injectJavaScript(js);
    }
  }, [view.swaps, view.shown]);

  // Web (iframe): listen for window messages from the document. Solo los de
  // NUESTRO iframe: la pantalla completa (otro iframe) se queda montada encima
  // y sus mensajes también llegan a esta ventana.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const listener = (ev: MessageEvent) => {
      if (ev.source !== iframeRef.current?.contentWindow) return;
      if (typeof ev.data === 'string') handleRawMessage(ev.data);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);
  // En iPad / web amplio la card del WebView está dentro de un wrapper
  // centrado con margen alrededor. Para que no se vea cortada por abajo
  // (en iOS sólo aplicamos esquinas top-only), añadimos las esquinas
  // inferiores también.
  const wideRadiusStyle = layout.isWide
    ? {
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        marginBottom: 8,
      }
    : null;

  // Push style updates into the WebView/iframe without rebuilding the HTML.
  useEffect(() => {
    if (!styleState) return;
    const payload = JSON.stringify(styleState);

    if (Platform.OS === 'web') {
      const iframe = iframeRef.current;
      if (!iframe) return;
      const send = () => {
        try {
          iframe.contentWindow?.postMessage(payload, '*');
        } catch {
          /* noop */
        }
      };
      if (readyRef.current) send();
      else iframe.addEventListener('load', send, { once: true });
      return;
    }

    if (!webViewRef.current) return;
    // injectJavaScript runs immediately even if the page is not fully ready;
    // we still guard against the bridge not being installed yet.
    const js = `(function(){try{var s=${payload};if(window.__SONG_BRIDGE__){window.__SONG_BRIDGE__.apply(s);}}catch(_){};true;})();`;
    webViewRef.current.injectJavaScript(js);
  }, [styleState]);

  // Desplazar la hoja a lo que interesa (solo si alguien lo pide).
  useEffect(() => {
    if (!readyRef.current) return;
    runScroll(scrollTo, webViewRef.current, iframeRef.current);
  }, [scrollTo]);

  // When the HTML reloads (structural change), the bridge is fresh — re-mark
  // not-ready so the next style update re-flushes on load.
  useEffect(() => {
    readyRef.current = false;
  }, [view.loaded]);

  // iOS: el alto del header puede llegar después de cargar (iPad, giro). La
  // hoja lo necesita para decidir si la canción cabe entera en pantalla.
  const useInset = fullBleed && Platform.OS === 'ios' && topInset > 0;
  useEffect(() => {
    if (!useInset || !readyRef.current) return;
    webViewRef.current?.injectJavaScript(
      `window.__SONG_VIEW_INSET__=${topInset};if(window.__SONG_LAYOUT__)window.__SONG_LAYOUT__.refit();true;`,
    );
  }, [useInset, topInset]);

  if (isLoading) {
    return (
      <View
        style={[
          styles.cardContainer,
          isDark && styles.cardContainerDark,
          styles.loadingContainer,
          wideRadiusStyle,
        ]}
      >
        <Spinner size="lg" color="#f4c11e" />
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          styles.cardContainer,
          isDark && styles.cardContainerDark,
          wideRadiusStyle,
        ]}
      >
        <iframe
          ref={iframeRef}
          srcDoc={view.loaded}
          onLoad={() => {
            readyRef.current = true;
            setReady(true);
            // Las teclas pulsadas con el foco en la letra no suben a la
            // ventana: se reenvían para que ⌘K y los atajos sigan funcionando.
            iframeRef.current?.contentDocument?.addEventListener(
              'keydown',
              makeKeydownForwarder(window),
            );
            runScroll(scrollTo, null, iframeRef.current);
            const s = pendingStyleRef.current;
            if (s) {
              try {
                iframeRef.current?.contentWindow?.postMessage(
                  JSON.stringify(s),
                  '*',
                );
              } catch {
                /* noop */
              }
            }
          }}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
            backgroundColor: themeColors(isDark).background,
          }}
          title="Letra de la canción"
        />
      </View>
    );
  }

  return (
    <View
      style={
        fullBleed
          ? [
              styles.fullBleedContainer,
              // Mismo color que el bodyBg del HTML (useSongProcessor) → un único
              // fondo continuo bajo el header transparente.
              { backgroundColor: themeColors(isDark).background },
            ]
          : [
              styles.cardContainer,
              isDark && styles.cardContainerDark,
              wideRadiusStyle,
            ]
      }
    >
      <WebView
        ref={webViewRef}
        // El HTML se carga inline (`source={{html}}`) → resuelve como
        // about:blank; no hay navegación legítima dentro de la canción
        // (sin <a>/window.location). `/songs/data` es escribible
        // públicamente, así que el contenido es no confiable: no ampliar
        // este whitelist ni quitar el guard de abajo sin repasar
        // docs/SEGURIDAD.md §3.1.
        originWhitelist={['about:blank']}
        onShouldStartLoadWithRequest={(req) => req.url === 'about:blank'}
        source={{ html: view.loaded }}
        style={[
          styles.webView,
          fullBleed && { backgroundColor: themeColors(isDark).background },
        ]}
        showsVerticalScrollIndicator={false}
        {...(useInset
          ? {
              // La hoja (utils/songSheetLayout.ts) lo resta al decidir si la
              // canción cabe entera en pantalla.
              injectedJavaScriptBeforeContentLoaded: `window.__SONG_VIEW_INSET__=${topInset};true;`,
              automaticallyAdjustContentInsets: false,
              contentInsetAdjustmentBehavior: 'never' as const,
              contentInset: { top: topInset, left: 0, right: 0, bottom: 0 },
              scrollIndicatorInsets: { top: topInset },
            }
          : {})}
        onMessage={(event) => handleRawMessage(event.nativeEvent.data)}
        onLoadEnd={() => {
          readyRef.current = true;
          setReady(true);
          runScroll(scrollTo, webViewRef.current, null);
          const s = pendingStyleRef.current;
          if (s && webViewRef.current) {
            const js = `(function(){try{var s=${JSON.stringify(s)};if(window.__SONG_BRIDGE__){window.__SONG_BRIDGE__.apply(s);}}catch(_){};true;})();`;
            webViewRef.current.injectJavaScript(js);
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  fullBleedContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  cardContainer: {
    flex: 1,
    marginHorizontal: 12,
    marginTop: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
    ...Platform.select({
      ios: {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      web: {
        borderRadius: radii.lg,
        marginBottom: 8,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      },
      default: {
        borderRadius: radii.lg,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  cardContainerDark: {
    backgroundColor: '#2C2C2E',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
      },
      default: {
        shadowOpacity: 0.15,
      },
    }),
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default SongDisplay;

// app/screens/ComunicaScreen.tsx
// WebView para comunica.movimientoconsolacion.com (portal de familias).
// Sin header propio: la web se ve a pantalla completa con cookies persistentes.
//   · iOS  → la web queda en zona segura (contentInset) y se desliza por debajo
//            de una barra glass nativa (systemChromeMaterial) al hacer scroll.
//            Extra de scroll al fondo para no dejar el botón bajo el tab bar.
//   · Android → franja lisa (blanca/oscura) en el notch; la web arranca debajo.

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import {
  Platform,
  View,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { useToast } from '@/contexts/AppToastContext';
import { Colors as ThemeColors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import GlassSurface from '@/components/ui/GlassSurface';
import WebViewNavControls from '@/components/ui/WebViewNavControls';

// CSS module reutilizado del iframe (solo aplica en web)
/* eslint-disable @typescript-eslint/no-require-imports */
const iframeStyles =
  Platform.OS === 'web' ? require('../../styles/comunica.module.css') : null;
/* eslint-enable @typescript-eslint/no-require-imports */

const COMUNICA_URL = 'https://comunica.movimientoconsolacion.com/aptest/?app=1';

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
 */
const themeBridgeJS = (theme: 'light' | 'dark') => `(function(){try{
  var t=${JSON.stringify(theme)};
  var r=document.documentElement;
  r.dataset.mcmTheme=t;
  r.classList.toggle('dark', t==='dark');
  r.classList.toggle('light', t!=='dark');
  r.style.colorScheme=t;
  document.cookie='mcm_theme='+t+';path=/;max-age=31536000;samesite=Lax';
}catch(e){}})();true;`;

// Altura aproximada del tab bar iOS (sin la safe-area inferior) + margen cómodo.
// Se suma como contentInset inferior para que el contenido pueda arrastrarse por
// encima del tab bar translúcido (si no, el último botón de la web queda tapado).
const IOS_TAB_BAR_HEIGHT = 49;
const IOS_BOTTOM_EXTRA = 32;

export default function ComunicaScreen() {
  const scheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const tintColor = ThemeColors[scheme].tint;
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // ── Navegación dentro de la web (atrás/adelante) ──────────────────────────
  const webViewRef = useRef<WebView>(null);
  const [nav, setNav] = useState({ canGoBack: false, canGoForward: false });
  const onNavStateChange = useCallback((s: WebViewNavigation) => {
    setNav({ canGoBack: s.canGoBack, canGoForward: s.canGoForward });
  }, []);
  const goBack = useCallback(() => webViewRef.current?.goBack(), []);
  const goForward = useCallback(() => webViewRef.current?.goForward(), []);

  // ── Tema (claro/oscuro) hacia la web ──────────────────────────────────────
  // La URL se congela con el tema del montaje: si dependiera de `scheme`, un
  // cambio de tema mutaría `source.uri` y RECARGARÍA la web, perdiendo lo que
  // el usuario tuviera escrito. Los cambios en caliente van por injectJavaScript.
  const initialTheme = useRef(scheme).current;
  const sourceUri = useMemo(
    () => `${COMUNICA_URL}&theme=${initialTheme}`,
    [initialTheme],
  );
  const themeJS = useMemo(() => themeBridgeJS(scheme), [scheme]);

  useEffect(() => {
    webViewRef.current?.injectJavaScript(themeJS);
  }, [themeJS]);

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

  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        loadingContainer: {
          ...StyleSheet.absoluteFillObject,
          justifyContent: 'center' as const,
          alignItems: 'center' as const,
          backgroundColor:
            scheme === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)',
        },
      }),
    [scheme],
  );

  const onLoadEnd = useCallback(() => setIsLoading(false), []);
  const onError = useCallback(() => {
    toast.show({
      variant: 'danger',
      label: 'Error al cargar el contenido. Verifica tu conexión a internet.',
      actionLabel: 'Cerrar',
      onActionPress: ({ hide }) => hide(),
    });
    setIsLoading(false);
  }, [toast]);

  const renderLoading = useCallback(
    () => (
      <View style={dynamicStyles.loadingContainer}>
        <ActivityIndicator size="large" color={tintColor} />
      </View>
    ),
    [dynamicStyles.loadingContainer, tintColor],
  );

  // Texto de la status bar: oscuro sobre glass claro, claro sobre glass oscuro.
  const barStyle = scheme === 'dark' ? 'light-content' : 'dark-content';
  // Fondo bajo el WebView: evita el flash blanco al cargar en modo oscuro.
  const pageBg = scheme === 'dark' ? '#1C1C1E' : '#FFFFFF';

  // ── Web: iframe ──────────────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <iframe
          src={sourceUri}
          title="Comunica"
          className={iframeStyles?.iframe}
          style={{ flex: 1, width: '100%', height: '100%', border: 'none' }}
          onLoad={onLoadEnd}
        />
        {isLoading && (
          <View style={dynamicStyles.loadingContainer}>
            <ActivityIndicator size="large" color={tintColor} />
          </View>
        )}
      </View>
    );
  }

  // ── iOS: WebView a pantalla completa bajo una barra glass en el notch ──────
  if (Platform.OS === 'ios') {
    const bottomInset = insets.bottom + IOS_TAB_BAR_HEIGHT + IOS_BOTTOM_EXTRA;
    return (
      <View style={[styles.container, { backgroundColor: pageBg }]}>
        <StatusBar barStyle={barStyle} translucent />
        <WebView
          ref={webViewRef}
          source={{ uri: sourceUri }}
          style={styles.webview}
          // Rendimiento y persistencia
          javaScriptEnabled={true}
          domStorageEnabled={true}
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
          // Reaplica el tema en cada carga de página (también tras navegar)
          injectedJavaScript={themeJS}
          // La web arranca en zona segura y se desliza bajo el glass al scrollear;
          // el inset inferior da margen para subir el contenido sobre el tab bar.
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          contentInset={{
            top: insets.top,
            left: 0,
            right: 0,
            bottom: bottomInset,
          }}
          scrollIndicatorInsets={{ top: insets.top, bottom: bottomInset }}
          onNavigationStateChange={onNavStateChange}
          renderLoading={renderLoading}
          onLoadEnd={onLoadEnd}
          onError={onError}
          onHttpError={onError}
        />
        {insets.top > 0 && (
          <View
            style={[styles.notchGlass, { height: insets.top }]}
            pointerEvents="none"
          >
            <GlassSurface variant="regular" bottomBorder />
          </View>
        )}
        <WebViewNavControls
          canGoBack={nav.canGoBack}
          canGoForward={nav.canGoForward}
          onBack={goBack}
          onForward={goForward}
          style={[
            styles.navControls,
            { bottom: insets.bottom + IOS_TAB_BAR_HEIGHT + 12 },
          ]}
        />
      </View>
    );
  }

  // ── Android: franja lisa en el notch, la web arranca debajo ────────────────
  const stripColor = pageBg;
  return (
    <View style={[styles.container, { backgroundColor: stripColor }]}>
      <StatusBar barStyle={barStyle} backgroundColor={stripColor} translucent />
      {insets.top > 0 && (
        <View
          style={[
            styles.notchBar,
            { backgroundColor: stripColor, height: insets.top },
          ]}
        />
      )}
      <WebView
        ref={webViewRef}
        source={{ uri: sourceUri }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        injectedJavaScript={themeJS}
        onNavigationStateChange={onNavStateChange}
        renderLoading={renderLoading}
        onLoadEnd={onLoadEnd}
        onError={onError}
        onHttpError={onError}
      />
      <WebViewNavControls
        canGoBack={nav.canGoBack}
        canGoForward={nav.canGoForward}
        onBack={goBack}
        onForward={goForward}
        style={[styles.navControls, { bottom: insets.bottom + 16 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  notchBar: {
    width: '100%',
  },
  // Barra glass superpuesta sobre el notch (solo iOS). overflow:hidden recorta
  // el material al alto de la safe-area; pointerEvents none deja pasar el scroll.
  notchGlass: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
  } as any,
  // Cápsula glass atrás/adelante flotante, abajo-izquierda. `bottom` lo fija
  // cada rama para quedar por encima del tab bar (translúcido en iOS).
  navControls: {
    position: 'absolute',
    left: 16,
  },
});

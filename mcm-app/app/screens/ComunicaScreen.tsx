// app/screens/ComunicaScreen.tsx
// WebView para comunica.movimientoconsolacion.com (portal de familias).
// Sin header propio: la web se ve a pantalla completa con cookies persistentes.
//   · iOS  → la web queda en zona segura (contentInset) y se desliza por debajo
//            de una barra glass nativa (systemChromeMaterial) al hacer scroll.
//            Extra de scroll al fondo para no dejar el botón bajo el tab bar.
//   · Android → franja lisa (blanca/oscura) en el notch; la web arranca debajo.
//
// La mecánica (tema hacia la web, historial, progreso, errores) vive en
// `hooks/useComunicaWebView.ts`; aquí solo queda el layout de cada plataforma.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View, StyleSheet, StatusBar, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { durations, easings } from '@/constants/animations';
import GlassSurface from '@/components/ui/GlassSurface';
import WebViewNavControls from '@/components/ui/WebViewNavControls';
import ComunicaLoader from '@/components/ui/ComunicaLoader';
import ComunicaTopProgress from '@/components/ui/ComunicaTopProgress';
import { COMUNICA_URL, useComunicaWebView } from '@/hooks/useComunicaWebView';

// CSS module reutilizado del iframe (solo aplica en web)
/* eslint-disable @typescript-eslint/no-require-imports */
const iframeStyles =
  Platform.OS === 'web' ? require('../../styles/comunica.module.css') : null;
/* eslint-enable @typescript-eslint/no-require-imports */

// Margen cómodo por encima del hueco de la barra de pestañas. El alto de la
// barra ya lo aporta `useTabBarClearance()`; esto es sólo el respiro extra para
// que el último botón de la web no quede pegado a ella.
const BOTTOM_EXTRA = 20;

// Fondo bajo el WebView. Debe coincidir con el fondo de página de la web:
// si no, se ve una costura de color en el rebote del overscroll y durante la
// carga. `#121316` es el fondo oscuro que usa comunica (acordado con la web).
const PAGE_BG_DARK = '#121316';
const PAGE_BG_LIGHT = '#FFFFFF';

// Hairline bajo la barra glass del notch. La de por defecto (negro al 10%) no
// se ve sobre fondo oscuro.
const HAIRLINE_DARK = 'rgba(255,255,255,0.12)';
const HAIRLINE_LIGHT = 'rgba(0,0,0,0.10)';

export default function ComunicaScreen() {
  const scheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  // La barra de pestañas flota sobre el WebView: hay que dejarle hueco con
  // contentInset (aquí no hay scroller de RN al que enganchar el colapso, así
  // que en este tab la barra se queda siempre expandida).
  const tabBarClearance = useTabBarClearance();

  // Fondo de la pantalla Y del propio WebView: sin esto, las zonas del
  // `contentInset` (notch arriba, hueco del tab bar abajo) y el rebote del
  // scroll los pinta WKWebView con su blanco por defecto — se veían dos
  // franjas claras en modo oscuro que además nunca cambiaban de color.
  const pageBg = scheme === 'dark' ? PAGE_BG_DARK : PAGE_BG_LIGHT;
  const hairline = scheme === 'dark' ? HAIRLINE_DARK : HAIRLINE_LIGHT;

  const {
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
  } = useComunicaWebView(pageBg);

  // La portada de carga se desvanece cuando la web ya está lista (y se
  // desmonta al acabar la transición, para no dejar una capa invisible encima).
  const loaderOpacity = useRef(new Animated.Value(1)).current;
  const [loaderMounted, setLoaderMounted] = useState(true);
  useEffect(() => {
    if (status === 'ready') {
      Animated.timing(loaderOpacity, {
        toValue: 0,
        duration: durations.slow,
        easing: easings.exit,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setLoaderMounted(false);
      });
    } else {
      setLoaderMounted(true);
      loaderOpacity.setValue(1);
    }
  }, [status, loaderOpacity]);

  // Texto de la status bar: oscuro sobre fondo claro, claro sobre fondo oscuro.
  const barStyle = scheme === 'dark' ? 'light-content' : 'dark-content';

  // Props comunes a iOS/Android del WebView.
  const commonWebViewProps = useMemo(
    () => ({
      // Rendimiento y persistencia
      javaScriptEnabled: true,
      domStorageEnabled: true,
      sharedCookiesEnabled: true,
      thirdPartyCookiesEnabled: true,
      // Reaplica el tema en cada carga de página (también tras navegar)
      injectedJavaScript: themeJS,
      onNavigationStateChange,
      onLoadStart,
      onLoadProgress,
      onLoadEnd,
      onError,
      onHttpError: onError,
    }),
    [
      themeJS,
      onNavigationStateChange,
      onLoadStart,
      onLoadProgress,
      onLoadEnd,
      onError,
    ],
  );

  const loaderOverlay = (insetTop: number, insetBottom: number) =>
    loaderMounted || status === 'error' ? (
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: loaderOpacity }]}
        pointerEvents={status === 'ready' ? 'none' : 'auto'}
      >
        <ComunicaLoader
          scheme={scheme}
          progress={progress}
          error={status === 'error'}
          onRetry={retry}
          insetTop={insetTop}
          insetBottom={insetBottom}
        />
      </Animated.View>
    ) : null;

  // Todavía no se sabe el tema guardado: no montamos la web para no cargarla
  // con el tema equivocado (dura lo que tarda un read de AsyncStorage).
  if (!sourceUri) {
    return (
      <View style={[styles.container, { backgroundColor: pageBg }]}>
        {loaderOverlay(insets.top, tabBarClearance)}
      </View>
    );
  }

  // ── Web: iframe ──────────────────────────────────────────────────────────
  // En web el iframe es cross-origin: no se le puede inyectar JS, así que el
  // único modo de propagar un cambio de tema en caliente es recargarlo con el
  // nuevo `?theme=` (de ahí que aquí sí dependa de `scheme` y no de la URL
  // congelada). Cambiar de tema es raro y en web no hay WebView que preservar.
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { backgroundColor: pageBg }]}>
        <iframe
          src={`${COMUNICA_URL}&theme=${scheme}`}
          title="Comunica"
          className={iframeStyles?.iframe}
          style={{
            flex: 1,
            width: '100%',
            height: '100%',
            border: 'none',
            backgroundColor: pageBg,
          }}
          onLoad={onLoadEnd}
        />
        {loaderOverlay(0, 0)}
      </View>
    );
  }

  // ── iOS: WebView a pantalla completa bajo una barra glass en el notch ──────
  if (Platform.OS === 'ios') {
    const bottomInset = tabBarClearance + BOTTOM_EXTRA;
    return (
      <View style={[styles.container, { backgroundColor: pageBg }]}>
        <StatusBar barStyle={barStyle} translucent />
        <WebView
          ref={webViewRef}
          source={{ uri: sourceUri }}
          style={[styles.webview, { backgroundColor: pageBg }]}
          // `opaque={false}` quita el fondo blanco propio de WKWebView: sin
          // esto el color de arriba lo pintaba él y ni salía oscuro ni cambiaba
          // al cambiar de tema.
          opaque={false}
          {...commonWebViewProps}
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
          // @ts-expect-error `scrollIndicatorInsets` es un passthrough de iOS
          // válido en runtime pero ausente de los tipos de react-native-webview.
          scrollIndicatorInsets={{ top: insets.top, bottom: bottomInset }}
        />
        {insets.top > 0 && (
          <View
            style={[styles.notchGlass, { height: insets.top }]}
            pointerEvents="none"
          >
            {/* El tinte explícito es lo que garantiza que la franja siga al
                tema de la APP: el material del sistema sin teñir se resolvía
                con la apariencia del dispositivo. */}
            <GlassSurface
              variant="regular"
              tintColor={pageBg}
              bottomBorder
              bottomBorderColor={hairline}
            />
          </View>
        )}
        <ComunicaTopProgress
          scheme={scheme}
          progress={progress}
          visible={pageLoading && status === 'ready'}
          top={insets.top}
        />
        <WebViewNavControls
          canGoBack={nav.canGoBack}
          canGoForward={nav.canGoForward}
          onBack={goBack}
          onForward={goForward}
          style={[styles.navControls, { bottom: tabBarClearance + 12 }]}
        />
        {loaderOverlay(insets.top, bottomInset)}
      </View>
    );
  }

  // ── Android: franja lisa en el notch, la web arranca debajo ────────────────
  return (
    <View style={[styles.container, { backgroundColor: pageBg }]}>
      <StatusBar barStyle={barStyle} backgroundColor={pageBg} translucent />
      {insets.top > 0 && (
        <View
          style={[
            styles.notchBar,
            { backgroundColor: pageBg, height: insets.top },
          ]}
        />
      )}
      <WebView
        ref={webViewRef}
        source={{ uri: sourceUri }}
        style={[styles.webview, { backgroundColor: pageBg }]}
        {...commonWebViewProps}
      />
      <ComunicaTopProgress
        scheme={scheme}
        progress={progress}
        visible={pageLoading && status === 'ready'}
        top={insets.top}
      />
      <WebViewNavControls
        canGoBack={nav.canGoBack}
        canGoForward={nav.canGoForward}
        onBack={goBack}
        onForward={goForward}
        style={[styles.navControls, { bottom: tabBarClearance + 12 }]}
      />
      {loaderOverlay(insets.top, tabBarClearance)}
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

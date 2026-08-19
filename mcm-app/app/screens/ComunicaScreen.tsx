// app/screens/ComunicaScreen.tsx
// WebView para comunica.movimientoconsolacion.com (portal de familias).
// Sin header propio: la web se ve a pantalla completa con cookies persistentes.
//   · iOS  → la web queda en zona segura (contentInset) y se desliza por debajo
//            de una barra glass nativa (systemChromeMaterial) al hacer scroll.
//            Extra de scroll al fondo para no dejar el botón bajo el tab bar.
//   · Android → mismo efecto, pero el hueco se reserva DENTRO de la página
//            (`safeAreaBridgeJS`), porque su WebView no admite `contentInset`.
//            La franja del notch es un overlay liso del color de la página.
//
// La mecánica (tema hacia la web, historial, progreso, errores) vive en
// `hooks/useComunicaWebView.ts`; aquí solo queda el layout de cada plataforma.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  View,
  StyleSheet,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { TAB_BAR_HEIGHT } from '@/constants/spacing';
import { useWebViewCollapse } from '@/components/tabs/tabBarController';
import { durations, reaEasings } from '@/constants/animations';
import GlassSurface from '@/components/ui/GlassSurface';
import WebViewNavControls from '@/components/ui/WebViewNavControls';
import ComunicaLoader from '@/components/ui/ComunicaLoader';
import ComunicaTopProgress from '@/components/ui/ComunicaTopProgress';
import {
  COMUNICA_URL,
  safeAreaBridgeJS,
  useComunicaWebView,
} from '@/hooks/useComunicaWebView';

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
  const { width: windowWidth } = useWindowDimensions();
  // La barra de pestañas flota sobre el WebView: hay que dejarle hueco con
  // contentInset (aquí no hay scroller de RN al que enganchar el colapso, así
  // que en este tab la barra se queda siempre expandida).
  const tabBarClearance = useTabBarClearance();
  // El WebView no es un scroller de RN, pero sí emite `onScroll`: con eso la
  // barra se compacta aquí igual que en el resto de la app.
  const onWebViewScroll = useWebViewCollapse();
  // Las flechas se apoyan JUSTO encima de la barra. `tabBarClearance` incluye
  // el respiro que se reserva al final del scroll y las dejaba flotando muy
  // altas; aquí basta con el alto de la barra más la safe area.
  const navControlsBottom = TAB_BAR_HEIGHT + insets.bottom + 8;

  // Fondo de la pantalla Y del propio WebView: sin esto, las zonas del
  // `contentInset` (notch arriba, hueco del tab bar abajo) y el rebote del
  // scroll los pinta WKWebView con su blanco por defecto — se veían dos
  // franjas claras en modo oscuro que además nunca cambiaban de color.
  const pageBg = scheme === 'dark' ? PAGE_BG_DARK : PAGE_BG_LIGHT;
  const hairline = scheme === 'dark' ? HAIRLINE_DARK : HAIRLINE_LIGHT;

  // Hueco que hay que dejar al final de la web: el de la barra flotante más un
  // respiro para que el último botón no quede pegado a ella.
  const bottomInset = tabBarClearance + BOTTOM_EXTRA;

  // Insets hacia DENTRO de la página. En iOS solo se publican las variables CSS
  // (el hueco de verdad lo pone `contentInset`); en Android son el mecanismo
  // único, porque allí el WebView no tiene `contentInset`.
  const safeAreaJS = useMemo(
    () =>
      safeAreaBridgeJS({
        top: insets.top,
        bottom: bottomInset,
        widthDp: windowWidth,
        applyPadding: Platform.OS === 'android',
      }),
    [insets.top, bottomInset, windowWidth],
  );

  const {
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
  } = useComunicaWebView(pageBg, safeAreaJS);

  // La portada de carga se desvanece cuando la web ya está lista (y se
  // desmonta al acabar la transición, para no dejar una capa invisible encima).
  const loaderOpacity = useSharedValue(1);
  const [loaderMounted, setLoaderMounted] = useState(true);

  // Se ajusta durante el render: si la web vuelve a cargar (reintento), la
  // portada tiene que estar montada YA en ese mismo render, no un frame después.
  const [lastStatus, setLastStatus] = useState(status);
  if (status !== lastStatus) {
    setLastStatus(status);
    if (status !== 'ready') setLoaderMounted(true);
  }

  useEffect(() => {
    if (status !== 'ready') {
      loaderOpacity.set(1);
      return;
    }
    loaderOpacity.set(
      withTiming(
        0,
        { duration: durations.slow, easing: reaEasings.exit },
        (finished) => {
          'worklet';
          if (finished) scheduleOnRN(setLoaderMounted, false);
        },
      ),
    );
  }, [status, loaderOpacity]);

  const loaderStyle = useAnimatedStyle(() => ({
    opacity: loaderOpacity.get(),
  }));

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
      // Reaplica tema e insets en cada carga de página (también tras navegar)
      injectedJavaScript: injectedJS,
      onNavigationStateChange,
      onLoadStart,
      onLoadProgress,
      onLoadEnd,
      onError,
      onHttpError: onError,
      onScroll: (event: {
        nativeEvent: {
          contentOffset: { y: number };
          contentSize?: { height: number };
          layoutMeasurement?: { height: number };
        };
      }) =>
        onWebViewScroll({
          y: event.nativeEvent.contentOffset.y,
          contentHeight: event.nativeEvent.contentSize?.height,
          viewportHeight: event.nativeEvent.layoutMeasurement?.height,
        }),
    }),
    [
      injectedJS,
      onWebViewScroll,
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
        style={[StyleSheet.absoluteFill, loaderStyle]}
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
          style={[styles.navControls, { bottom: navControlsBottom }]}
        />
        {loaderOverlay(insets.top, bottomInset)}
      </View>
    );
  }

  // ── Android: WebView a pantalla completa bajo una franja lisa en el notch ──
  // El hueco de arriba y el de abajo los reserva la PÁGINA (`safeAreaJS`), no
  // el contenedor: el WebView de Android no tiene `contentInset`. Así la web
  // arranca en zona segura pero se desliza por debajo de la franja al scrollear,
  // igual que en iOS.
  return (
    <View style={[styles.container, { backgroundColor: pageBg }]}>
      <StatusBar barStyle={barStyle} backgroundColor={pageBg} translucent />
      <WebView
        ref={webViewRef}
        source={{ uri: sourceUri }}
        style={[styles.webview, { backgroundColor: pageBg }]}
        {...commonWebViewProps}
      />
      {insets.top > 0 && (
        <View
          style={[styles.notchBar, { height: insets.top }]}
          pointerEvents="none"
        >
          {/* Opaca y del color de la página: sin blur real en Android, una
              franja translúcida con texto pasando por debajo se ve sucia. */}
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: pageBg }]}
          />
          <View style={[styles.hairline, { backgroundColor: hairline }]} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Franja opaca superpuesta sobre el notch (Android). La web pasa por debajo:
  // el hueco equivalente lo reserva ella con el padding que le inyectamos.
  notchBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  hairline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
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

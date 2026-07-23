// app/screens/ComunicaScreen.tsx
// WebView para comunica.movimientoconsolacion.com (portal de familias).
// Sin header propio: la web se ve a pantalla completa con cookies persistentes.
//   · iOS  → la web queda en zona segura (contentInset) y se desliza por debajo
//            de una barra glass nativa (systemChromeMaterial) al hacer scroll.
//            Extra de scroll al fondo para no dejar el botón bajo el tab bar.
//   · Android → franja lisa (blanca/oscura) en el notch; la web arranca debajo.

import React, { useState, useCallback, useMemo } from 'react';
import {
  Platform,
  View,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useToast } from '@/contexts/AppToastContext';
import { Colors as ThemeColors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import GlassSurface from '@/components/ui/GlassSurface';

// CSS module reutilizado del iframe (solo aplica en web)
/* eslint-disable @typescript-eslint/no-require-imports */
const iframeStyles =
  Platform.OS === 'web' ? require('../../styles/comunica.module.css') : null;
/* eslint-enable @typescript-eslint/no-require-imports */

const COMUNICA_URL = 'https://comunica.movimientoconsolacion.com/aptest/?app=1';

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

  // ── Web: iframe ──────────────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <iframe
          src={COMUNICA_URL}
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
      <View style={styles.container}>
        <StatusBar barStyle={barStyle} translucent />
        <WebView
          source={{ uri: COMUNICA_URL }}
          style={styles.webview}
          // Rendimiento y persistencia
          javaScriptEnabled={true}
          domStorageEnabled={true}
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
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
      </View>
    );
  }

  // ── Android: franja lisa en el notch, la web arranca debajo ────────────────
  const stripColor = scheme === 'dark' ? '#1C1C1E' : '#FFFFFF';
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
        source={{ uri: COMUNICA_URL }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        renderLoading={renderLoading}
        onLoadEnd={onLoadEnd}
        onError={onError}
        onHttpError={onError}
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
});

// app/screens/ComunicaScreen.tsx
// WebView para comunica.movimientoconsolacion.com
// Sin header, pantalla completa, cookies persistentes.

import React, { useState, useCallback, useMemo } from 'react';
import { Platform, View, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { ActivityIndicator, Portal, Snackbar } from 'react-native-paper';
import { Colors as ThemeColors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

// CSS module reutilizado del iframe (solo aplica en web)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const iframeStyles = Platform.OS === 'web' ? require('../(tabsdesactivados)/comunica.module.css') : null;

const COMUNICA_URL = 'https://comunica.movimientoconsolacion.com';

// Color por defecto para la zona del notch (naranja de Comunica)
const DEFAULT_NOTCH_COLOR = '#E08A3C';

// JavaScript para detectar el color del header de la web cargada
const INJECTED_JAVASCRIPT = `
  (function() {
    function rgbToHex(rgb) {
      if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return null;
      var match = rgb.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
      if (!match) return null;
      return '#' + ((1 << 24) + (parseInt(match[1]) << 16) + (parseInt(match[2]) << 8) + parseInt(match[3])).toString(16).slice(1);
    }

    function detectTopColor() {
      var selectors = ['header', 'nav', '.header', '#header', '.navbar', '.nav', '[role="banner"]', '.top-bar', '.topbar', '.site-header', '#masthead', '.app-bar', '[class*="header"]', '[class*="toolbar"]'];
      for (var i = 0; i < selectors.length; i++) {
        var el = document.querySelector(selectors[i]);
        if (el) {
          var bg = window.getComputedStyle(el).backgroundColor;
          var hex = rgbToHex(bg);
          if (hex) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'notchColor', color: hex }));
            return;
          }
        }
      }
      if (document.body && document.body.firstElementChild) {
        var bg2 = window.getComputedStyle(document.body.firstElementChild).backgroundColor;
        var hex2 = rgbToHex(bg2);
        if (hex2) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'notchColor', color: hex2 }));
          return;
        }
      }
      if (document.body) {
        var bodyBg = window.getComputedStyle(document.body).backgroundColor;
        var bodyHex = rgbToHex(bodyBg);
        if (bodyHex) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'notchColor', color: bodyHex }));
        }
      }
    }

    setTimeout(detectTopColor, 500);
    window.addEventListener('load', function() { setTimeout(detectTopColor, 800); });
  })();
  true;
`;

export default function ComunicaScreen() {
  const scheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const tintColor = ThemeColors[scheme].tint;
  const [notchColor, setNotchColor] = useState(DEFAULT_NOTCH_COLOR);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackVisible, setSnackVisible] = useState(false);

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
    setError('Error al cargar el contenido. Verifica tu conexión a internet.');
    setSnackVisible(true);
    setIsLoading(false);
  }, []);
  const onDismissSnack = useCallback(() => setSnackVisible(false), []);

  const handleMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'notchColor' && data.color) {
          setNotchColor(data.color);
        }
      } catch {
        // Ignorar mensajes no JSON
      }
    },
    [],
  );

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

  // ── iOS / Android: WebView nativo con barra de color en el notch ────────
  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={notchColor}
        translucent
      />
      {insets.top > 0 && (
        <View
          style={[
            styles.notchBar,
            { backgroundColor: notchColor, height: insets.top },
          ]}
        />
      )}
      <WebView
        source={{ uri: COMUNICA_URL }}
        style={styles.webview}
        // Rendimiento y persistencia
        javaScriptEnabled={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        // Pantalla completa en iOS (contenido detrás del tab bar translúcido)
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        // Inyección de JS para detectar color del header
        injectedJavaScript={INJECTED_JAVASCRIPT}
        onMessage={handleMessage}
        // Loader
        renderLoading={() => (
          <View style={dynamicStyles.loadingContainer}>
            <ActivityIndicator size="large" color={tintColor} />
          </View>
        )}
        onLoadEnd={onLoadEnd}
        onError={onError}
        onHttpError={onError}
      />
      <Portal>
        <Snackbar
          visible={snackVisible}
          onDismiss={onDismissSnack}
          action={{ label: 'Cerrar', onPress: onDismissSnack }}
          duration={Snackbar.DURATION_MEDIUM}
          style={{ backgroundColor: '#f44336' }}
        >
          {error}
        </Snackbar>
      </Portal>
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
  webview: {
    flex: 1,
  } as any,
});

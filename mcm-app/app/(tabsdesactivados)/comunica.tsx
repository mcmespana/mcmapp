// app/(tabs)/comunica.tsx

import React, { useState } from 'react';
import { Platform, View, StyleSheet, StatusBar } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, Portal, Snackbar } from 'react-native-paper';
import { Colors as ThemeColors } from '@/constants/colors';
import iframeStyles from './comunica.module.css';

const URL = 'https://comunica.movimientoconsolacion.com';

// Color por defecto (morado LC, el color de Comunica)
const DEFAULT_NOTCH_COLOR = '#9D1E74';

// JS inyectado para detectar el color del header de la web
const HEADER_COLOR_DETECTION_JS = `
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
    // Fallback: primer hijo del body
    if (document.body && document.body.firstElementChild) {
      var bg2 = window.getComputedStyle(document.body.firstElementChild).backgroundColor;
      var hex2 = rgbToHex(bg2);
      if (hex2) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'notchColor', color: hex2 }));
        return;
      }
    }
    // Fallback: background del body
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

export default function Comunica() {
  const insets = useSafeAreaInsets();
  const [notchColor, setNotchColor] = useState(DEFAULT_NOTCH_COLOR);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  const onLoadEnd = () => {
    setIsLoading(false);
  };

  const onError = () => {
    setError(
      'Error al cargar el contenido. Por favor, verifica tu conexión a internet.',
    );
    setVisible(true);
    setIsLoading(false);
  };

  const onNavigationStateChange = (navState: WebViewNavigation) => {
    console.log('Navigation changed:', navState);
  };

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'notchColor' && data.color) {
        setNotchColor(data.color);
      }
    } catch {
      // Ignorar mensajes no JSON
    }
  };

  const onDismissSnackBar = () => setVisible(false);

  // Fallback en web: usamos un iframe (no hay notch en web)
  if (Platform.OS === 'web') {
    return (
      <View style={styles.containerWeb}>
        <iframe
          src={URL}
          title="Área Privada"
          className={iframeStyles.iframe}
          onError={onError}
          onLoad={onLoadEnd}
        />
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={ThemeColors.light.tint} />
          </View>
        )}
      </View>
    );
  }

  // En iOS/Android: barra de color en el notch + WebView edge-to-edge
  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={notchColor}
        translucent
      />
      {insets.top > 0 && (
        <View
          style={[styles.notchBar, { backgroundColor: notchColor, height: insets.top }]}
        />
      )}
      <WebView
        source={{ uri: URL }}
        style={styles.webview}
        startInLoadingState={true}
        injectedJavaScript={HEADER_COLOR_DETECTION_JS}
        onMessage={handleMessage}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={ThemeColors.light.tint} />
          </View>
        )}
        onLoadEnd={onLoadEnd}
        onError={onError}
        onNavigationStateChange={onNavigationStateChange}
      />
      <Portal>
        <Snackbar
          visible={visible}
          onDismiss={onDismissSnackBar}
          action={{
            label: 'Cerrar',
            onPress: onDismissSnackBar,
          }}
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
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  containerWeb: {
    flex: 1,
    margin: 0,
    padding: 0,
    position: 'relative',
  },
});

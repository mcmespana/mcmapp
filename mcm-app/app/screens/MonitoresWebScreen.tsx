import React, { useState, useMemo } from 'react';
import { Platform, View, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { ActivityIndicator, Portal, Snackbar } from 'react-native-paper';
import { Colors as ThemeColors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import iframeStyles from '../(tabsdesactivados)/comunica.module.css';

const URL = 'https://movimientoconsolacion.sinergiacrm.org/';

// Color por defecto para la zona del notch
const DEFAULT_NOTCH_COLOR = '#253883';

// CSS para inyectar y ocultar elementos
const INJECTED_CSS = `
  .p_login_top,
  .p_login_bottom {
    display: none !important;
  }
`;

// JavaScript para inyectar el CSS, ocultar elementos, y detectar color del header
const INJECTED_JAVASCRIPT = `
  (function() {
    // Función para ocultar los elementos
    function hideElements() {
      var elementsToHide = document.querySelectorAll('.p_login_top, .p_login_bottom');
      elementsToHide.forEach(function(el) {
        el.style.display = 'none';
        el.style.visibility = 'hidden';
        el.style.opacity = '0';
        el.style.height = '0';
        el.style.overflow = 'hidden';
      });
    }

    // Inyectar CSS
    var style = document.createElement('style');
    style.textContent = \`${INJECTED_CSS}\`;
    document.head.appendChild(style);

    // Ejecutar inmediatamente
    hideElements();

    // Ejecutar cuando el DOM esté listo
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', hideElements);
    } else {
      hideElements();
    }

    // Observar cambios en el DOM por si los elementos se cargan dinámicamente
    var observer = new MutationObserver(function() {
      hideElements();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Ejecutar cada 100ms durante los primeros 2 segundos para asegurar
    var attempts = 0;
    var interval = setInterval(function() {
      hideElements();
      attempts++;
      if (attempts > 20) {
        clearInterval(interval);
      }
    }, 100);

    // --- Detección de color del header ---
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

export default function MonitoresWebScreen() {
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const dynamicStyles = useMemo(() => createDynamicStyles(scheme), [scheme]);
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

  // Fallback en web: usamos un iframe con estilos inyectados
  if (Platform.OS === 'web') {
    React.useEffect(() => {
      const iframe = document.querySelector(
        'iframe[title="Comunica MCM - Monitores"]',
      ) as HTMLIFrameElement;
      if (iframe) {
        const injectStyles = () => {
          try {
            const iframeDoc =
              iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc) {
              const style = iframeDoc.createElement('style');
              style.textContent = INJECTED_CSS;
              iframeDoc.head.appendChild(style);

              const hideElements = () => {
                const elementsToHide = iframeDoc.querySelectorAll(
                  '.p_login_top, .p_login_bottom',
                );
                elementsToHide.forEach((el: Element) => {
                  const htmlEl = el as HTMLElement;
                  htmlEl.style.display = 'none';
                  htmlEl.style.visibility = 'hidden';
                  htmlEl.style.opacity = '0';
                  htmlEl.style.height = '0';
                  htmlEl.style.overflow = 'hidden';
                });
              };

              hideElements();

              const observer = new MutationObserver(hideElements);
              observer.observe(iframeDoc.body, {
                childList: true,
                subtree: true,
              });

              let attempts = 0;
              const interval = setInterval(() => {
                hideElements();
                attempts++;
                if (attempts > 20) {
                  clearInterval(interval);
                }
              }, 100);
            }
          } catch (e) {
            console.log('No se pudieron inyectar estilos en iframe:', e);
          }
        };

        iframe.addEventListener('load', injectStyles);
      }
    }, []);

    return (
      <View style={styles.containerWeb}>
        <iframe
          src={URL}
          title="Comunica MCM - Monitores"
          className={iframeStyles.iframe}
          onError={onError}
          onLoad={onLoadEnd}
        />
        {isLoading && (
          <View style={dynamicStyles.loadingContainer}>
            <ActivityIndicator size="large" color={ThemeColors[scheme].tint} />
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
          style={[
            styles.notchBar,
            { backgroundColor: notchColor, height: insets.top },
          ]}
        />
      )}
      <WebView
        source={{ uri: URL }}
        style={styles.webview}
        startInLoadingState={true}
        injectedJavaScript={INJECTED_JAVASCRIPT}
        onMessage={handleMessage}
        renderLoading={() => (
          <View style={dynamicStyles.loadingContainer}>
            <ActivityIndicator size="large" color={ThemeColors[scheme].tint} />
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

const createDynamicStyles = (scheme: 'light' | 'dark') =>
  StyleSheet.create({
    loadingContainer: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor:
        scheme === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.8)',
    },
  });

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
  containerWeb: {
    flex: 1,
    margin: 0,
    padding: 0,
    position: 'relative',
  },
});

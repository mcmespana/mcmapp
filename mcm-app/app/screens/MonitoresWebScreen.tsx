import React, { useState } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { ActivityIndicator, Portal, Snackbar } from 'react-native-paper';
import spacing from '@/constants/spacing';
import { Colors as ThemeColors } from '@/constants/colors';
import iframeStyles from '../(tabsdesactivados)/comunica.module.css';

const URL = 'https://movimientoconsolacion.sinergiacrm.org/';

// CSS para inyectar y ocultar elementos
const INJECTED_CSS = `
  .p_login_top,
  .p_login_bottom {
    display: none !important;
  }
`;

// JavaScript para inyectar el CSS y ocultar elementos
const INJECTED_JAVASCRIPT = `
  (function() {
    // Función para ocultar los elementos
    function hideElements() {
      const elementsToHide = document.querySelectorAll('.p_login_top, .p_login_bottom');
      elementsToHide.forEach(el => {
        el.style.display = 'none';
        el.style.visibility = 'hidden';
        el.style.opacity = '0';
        el.style.height = '0';
        el.style.overflow = 'hidden';
      });
    }

    // Inyectar CSS
    const style = document.createElement('style');
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
    const observer = new MutationObserver(() => {
      hideElements();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Ejecutar cada 100ms durante los primeros 2 segundos para asegurar
    let attempts = 0;
    const interval = setInterval(() => {
      hideElements();
      attempts++;
      if (attempts > 20) {
        clearInterval(interval);
      }
    }, 100);
  })();
  true;
`;

export default function MonitoresWebScreen() {
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
    // Aquí puedes manejar cambios en la navegación si es necesario
    console.log('Navigation changed:', navState);
  };

  const onDismissSnackBar = () => setVisible(false);

  // Fallback en web: usamos un iframe con estilos inyectados
  if (Platform.OS === 'web') {
    // Para web, inyectamos los estilos mediante un script cuando carga el iframe
    React.useEffect(() => {
      const iframe = document.querySelector('iframe[title="Comunica MCM - Monitores"]') as HTMLIFrameElement;
      if (iframe) {
        const injectStyles = () => {
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc) {
              // Inyectar CSS
              const style = iframeDoc.createElement('style');
              style.textContent = INJECTED_CSS;
              iframeDoc.head.appendChild(style);

              // También ocultar directamente con JavaScript
              const hideElements = () => {
                const elementsToHide = iframeDoc.querySelectorAll('.p_login_top, .p_login_bottom');
                elementsToHide.forEach((el: Element) => {
                  const htmlEl = el as HTMLElement;
                  htmlEl.style.display = 'none';
                  htmlEl.style.visibility = 'hidden';
                  htmlEl.style.opacity = '0';
                  htmlEl.style.height = '0';
                  htmlEl.style.overflow = 'hidden';
                });
              };

              // Ejecutar inmediatamente
              hideElements();

              // Observar cambios en el DOM
              const observer = new MutationObserver(hideElements);
              observer.observe(iframeDoc.body, {
                childList: true,
                subtree: true
              });

              // Ejecutar periódicamente durante los primeros 2 segundos
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
            // Si hay problemas de CORS, no podemos inyectar estilos en web
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
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={ThemeColors.light.tint} />
          </View>
        )}
      </View>
    );
  }

  // En iOS/Android usamos el WebView nativo con CSS inyectado
  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: URL }}
        style={styles.webview}
        startInLoadingState={true}
        injectedJavaScript={INJECTED_JAVASCRIPT}
        onMessage={() => {}}
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
  // Estilos comunes para móvil
  container: {
    flex: 1,
    margin: spacing.sm,
    position: 'relative',
  },
  webview: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  } as any,
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  // Estilos para web: eliminamos márgenes y aprovechamos todo el espacio
  containerWeb: {
    flex: 1,
    margin: 0,
    padding: 0,
    position: 'relative',
  },
});

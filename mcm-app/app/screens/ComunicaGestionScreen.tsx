// app/screens/ComunicaGestionScreen.tsx
// WebView para movimientoconsolacion.sinergiacrm.org (área de gestión/monitores)
// Sin header, pantalla completa, cookies persistentes.
// Inyecta JS para ocultar elementos de login de la web.

import React, { useState, useCallback, useMemo } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { ActivityIndicator, Portal, Snackbar } from 'react-native-paper';
import { Colors as ThemeColors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

// CSS module reutilizado del iframe (solo aplica en web)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const iframeStyles = Platform.OS === 'web' ? require('../(tabsdesactivados)/comunica.module.css') : null;

const GESTION_URL = 'https://movimientoconsolacion.sinergiacrm.org/';

// Oculta elementos decorativos de login en la web de SinergíaCRM
const INJECTED_CSS = `
  .p_login_top,
  .p_login_bottom {
    display: none !important;
  }
`;

const INJECTED_JAVASCRIPT = `
  (function() {
    function hideElements() {
      const els = document.querySelectorAll('.p_login_top, .p_login_bottom');
      els.forEach(el => {
        el.style.display = 'none';
        el.style.visibility = 'hidden';
        el.style.height = '0';
        el.style.overflow = 'hidden';
      });
    }
    const style = document.createElement('style');
    style.textContent = \`${INJECTED_CSS}\`;
    document.head.appendChild(style);
    hideElements();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', hideElements);
    }
    const observer = new MutationObserver(hideElements);
    observer.observe(document.body, { childList: true, subtree: true });
    let attempts = 0;
    const interval = setInterval(() => {
      hideElements();
      if (++attempts > 20) clearInterval(interval);
    }, 100);
  })();
  true;
`;

export default function ComunicaGestionScreen() {
  const scheme = useColorScheme() ?? 'light';
  const tintColor = ThemeColors[scheme].tint;
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

  // ── Web: iframe ──────────────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <iframe
          src={GESTION_URL}
          title="Comunica Gestión"
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

  // ── iOS / Android: WebView nativo ────────────────────────────────────────
  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: GESTION_URL }}
        style={styles.webview}
        // Rendimiento y persistencia
        javaScriptEnabled={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        // JS inyectado para ocultar elementos de login
        injectedJavaScript={INJECTED_JAVASCRIPT}
        onMessage={() => {}}
        // Pantalla completa en iOS (contenido detrás del tab bar translúcido)
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
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
  webview: {
    flex: 1,
  } as any,
});

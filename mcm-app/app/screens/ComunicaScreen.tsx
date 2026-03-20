// app/screens/ComunicaScreen.tsx
// WebView para comunica.movimientoconsolacion.com
// Sin header, pantalla completa, cookies persistentes.
// Usa color fijo para el notch — la detección automática no es fiable.

import React, { useState, useCallback, useMemo } from 'react';
import { Platform, View, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { ActivityIndicator, Portal, Snackbar } from 'react-native-paper';
import { Colors as ThemeColors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

// CSS module reutilizado del iframe (solo aplica en web)

/* eslint-disable @typescript-eslint/no-require-imports */
const iframeStyles =
  Platform.OS === 'web'
    ? require('../(tabsdesactivados)/comunica.module.css')
    : null;
/* eslint-enable @typescript-eslint/no-require-imports */

const COMUNICA_URL = 'https://comunica.movimientoconsolacion.com';

// Color fijo para la zona del notch (azul oscuro del header de Comunica MCM)
// Se usa color fijo porque la detección automática del color del header
// de la web no es fiable: muchas veces devuelve blanco (#ffffff) y hace
// que el texto de la barra de estado (hora, batería, etc.) sea ilegible.
const NOTCH_COLOR = '#253883';

export default function ComunicaScreen() {
  const scheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
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
        backgroundColor={NOTCH_COLOR}
        translucent
      />
      {insets.top > 0 && (
        <View
          style={[
            styles.notchBar,
            { backgroundColor: NOTCH_COLOR, height: insets.top },
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

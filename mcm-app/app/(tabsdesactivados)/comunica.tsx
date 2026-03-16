// app/(tabsdesactivados)/comunica.tsx
// DESACTIVADO - versión anterior de la pantalla Comunica.
// Usa color fijo para el notch.

import React, { useState } from 'react';
import { Platform, View, StyleSheet, StatusBar } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, Portal, Snackbar } from 'react-native-paper';
import { Colors as ThemeColors } from '@/constants/colors';
import iframeStyles from './comunica.module.css';

const URL = 'https://comunica.movimientoconsolacion.com';

// Color fijo para la zona del notch (azul oscuro MCM)
const NOTCH_COLOR = '#253883';

export default function Comunica() {
  const insets = useSafeAreaInsets();
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
        backgroundColor={NOTCH_COLOR}
        translucent
      />
      {insets.top > 0 && (
        <View
          style={[styles.notchBar, { backgroundColor: NOTCH_COLOR, height: insets.top }]}
        />
      )}
      <WebView
        source={{ uri: URL }}
        style={styles.webview}
        startInLoadingState={true}
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

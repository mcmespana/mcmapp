// app/(tabs)/comunica.tsx

import React, { useState } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { ActivityIndicator, Portal, Snackbar } from 'react-native-paper';
import spacing from '@/constants/spacing';
import { Colors as ThemeColors } from '@/constants/colors';
import iframeStyles from './comunica.module.css';

const URL = 'https://comunica.movimientoconsolacion.com';

export default function Comunica() {
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

  // Fallback en web: usamos un iframe
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

  // En iOS/Android usamos el WebView nativo
  return (
    <View style={styles.container}>
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

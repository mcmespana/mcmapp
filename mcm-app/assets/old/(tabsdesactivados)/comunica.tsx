// app/(tabsdesactivados)/comunica.tsx
// DESACTIVADO - versión anterior de la pantalla Comunica.
// Usa color fijo para el notch.

import React, { useState } from 'react';
import { Platform, View, StyleSheet, StatusBar } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator } from 'react-native';
import { useToast } from 'heroui-native';
import { Colors as ThemeColors } from '@/constants/colors';
import iframeStyles from './comunica.module.css';

const URL = 'https://comunica.movimientoconsolacion.com';

// Color fijo para la zona del notch (azul oscuro MCM)
const NOTCH_COLOR = '#253883';

export default function Comunica() {
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const onLoadEnd = () => {
    setIsLoading(false);
  };

  const onError = () => {
    toast.show({
      variant: 'danger',
      label:
        'Error al cargar el contenido. Por favor, verifica tu conexión a internet.',
      actionLabel: 'Cerrar',
      onActionPress: ({ hide }) => hide(),
    });
    setIsLoading(false);
  };

  const onNavigationStateChange = (navState: WebViewNavigation) => {
    console.log('Navigation changed:', navState);
  };

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
          style={[
            styles.notchBar,
            { backgroundColor: NOTCH_COLOR, height: insets.top },
          ]}
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

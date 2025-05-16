/*import React from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import spacing from '@/constants/spacing';

const URL = 'https://steelblue-mallard-178509.hostingersite.com/area-privada/';

export default function Comunica() {
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, styles.webContainer]}>
        <iframe
          src={URL}
          title="Área Privada"
          style={{ ...styles.iframe, border: 0 }}
        />
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: URL }}
        style={styles.webview}
        startInLoadingState
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: spacing.sm,
  },
  // Solo web: quita márgenes y pon padding:0 para usar todo el espacio
  webContainer: {
    margin: 0,
    padding: 0,
  },
  iframe: {
    flex: 1,
    width: '100%',
    height: '100%',
    // border is not a valid React Native style property
  },
  webview: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
*/

// app/(tabs)/comunica.tsx

import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import spacing from '@/constants/spacing';

const URL = 'https://steelblue-mallard-178509.hostingersite.com/area-privada/';

export default function Comunica() {
  // Fallback en web: usamos un iframe
  if (Platform.OS === 'web') {
    return (
      <View style={styles.containerWeb}>
        <iframe
          src={URL}
          title="Área Privada"
          style={styles.iframe}
        />
      </View>
    );
  }

  // En iOS/Android usamos el WebView nativo
  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: URL }}
        style={styles.webview}
        startInLoadingState
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Estilos comunes para móvil
  container: {
    flex: 1,
    margin: spacing.sm,
  },
  webview: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },

  // Estilos para web: eliminamos margenes y aprovechamos todo el espacio
  containerWeb: {
    flex: 1,
    margin: 0,
    padding: 0,
  },
  iframe: {
    flex: 1,
    width: '100%',
    height: '100%',
    //border: 0,
  },
});

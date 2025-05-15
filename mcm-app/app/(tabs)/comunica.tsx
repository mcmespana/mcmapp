// app/(tabs)/comunica.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import spacing from '@/constants/spacing';

export default function Comunica() {
  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: 'https://steelblue-mallard-178509.hostingersite.com/area-privada/' }}
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
  webview: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
});

import React from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import theme from '../app/styles/theme'; // Using theme for colors

interface SongDisplayProps {
  songHtml: string;
  isLoading: boolean;
}

const SongDisplay: React.FC<SongDisplayProps> = ({ songHtml, isLoading }) => {
  if (isLoading) {
    return (
      <View style={[styles.webViewContainer, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webViewContainer}>
        <div
          style={{
            width: '100%',
            maxWidth: '800px',
            margin: '0 auto',
            padding: '16px 24px',
            backgroundColor: 'white',
            boxSizing: 'border-box',
            minHeight: '100%',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
          dangerouslySetInnerHTML={{ __html: songHtml }}
        />
      </View>
    );
  }

  return (
    <View style={styles.webViewContainer}>
      <WebView
        originWhitelist={['*']}
        source={{ html: songHtml }}
        style={styles.webView}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  webViewContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    ...(Platform.OS === 'web' ? { paddingVertical: 16 } : {}),
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  webView: {
    flex: 1,
  },
});

export default SongDisplay;

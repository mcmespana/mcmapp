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
          style={{ flex: 1, width: '100%', height: '100%', overflowY: 'auto' }}
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
    borderWidth: 1,
    borderColor: '#ddd', // From SongDetailScreen styles
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

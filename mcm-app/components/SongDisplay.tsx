import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { AppColors } from '../app/styles/theme'; // Assuming AppColors might be used for loading indicator or styles

interface SongDisplayProps {
  songHtml: string;
  isLoading: boolean;
}

const SongDisplay: React.FC<SongDisplayProps> = ({ songHtml, isLoading }) => {
  if (isLoading) {
    return (
      <View style={[styles.webViewContainer, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={AppColors.primary} />
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

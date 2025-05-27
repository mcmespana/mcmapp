import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { useThemeColor } from '@/hooks/useThemeColor'; // Import useThemeColor

interface SongDisplayProps {
  songHtml: string;
  isLoading: boolean;
}

const SongDisplay: React.FC<SongDisplayProps> = ({ songHtml, isLoading }) => {
  if (isLoading) {
    const primaryColor = useThemeColor({}, 'primary');
    return (
      <View style={[styles.webViewContainer, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={primaryColor} />
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

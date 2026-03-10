import React from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { useColorScheme } from '@/hooks/useColorScheme';

interface SongDisplayProps {
  songHtml: string;
  isLoading: boolean;
}

const SongDisplay: React.FC<SongDisplayProps> = ({ songHtml, isLoading }) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  if (isLoading) {
    return (
      <View
        style={[
          styles.webViewContainer,
          styles.loadingContainer,
          { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' },
        ]}
      >
        <ActivityIndicator size="large" color="#f4c11e" />
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          styles.webViewContainer,
          { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' },
        ]}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '100%',
            margin: 0,
            padding: '12px 16px',
            backgroundColor: isDark ? '#2C2C2E' : '#fff',
            boxSizing: 'border-box' as const,
            minHeight: '100%',
            borderRadius: 12,
            boxShadow: isDark
              ? '0 1px 3px rgba(0,0,0,0.3)'
              : '0 1px 4px rgba(0,0,0,0.06)',
            overflowY: 'auto' as const,
          }}
          dangerouslySetInnerHTML={{ __html: songHtml }}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.webViewContainer,
        { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' },
      ]}
    >
      <WebView
        originWhitelist={['*']}
        source={{ html: songHtml }}
        style={[
          styles.webView,
          { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' },
        ]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  webViewContainer: {
    flex: 1,
    ...(Platform.OS === 'web'
      ? { paddingVertical: 8, paddingHorizontal: 12 }
      : {}),
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

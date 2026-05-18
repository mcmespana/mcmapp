import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { Spinner } from 'heroui-native';
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
          styles.cardContainer,
          isDark && styles.cardContainerDark,
          styles.loadingContainer,
        ]}
      >
        <Spinner size="lg" color="#f4c11e" />
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.cardContainer, isDark && styles.cardContainerDark]}>
        <iframe
          srcDoc={songHtml}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
            backgroundColor: isDark ? '#2C2C2E' : '#fff',
          }}
          title="Song content"
        />
      </View>
    );
  }

  return (
    <View style={[styles.cardContainer, isDark && styles.cardContainerDark]}>
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
  cardContainer: {
    flex: 1,
    marginHorizontal: 12,
    marginTop: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
    ...Platform.select({
      ios: {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      web: {
        borderRadius: 16,
        marginBottom: 8,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      },
      default: {
        borderRadius: 16,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  cardContainerDark: {
    backgroundColor: '#2C2C2E',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
      },
      default: {
        shadowOpacity: 0.15,
      },
    }),
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default SongDisplay;

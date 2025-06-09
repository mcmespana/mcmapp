import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { RootStackParamList } from '../(tabs)/cancionero';
import { useSettings } from '../../contexts/SettingsContext';
import { useSongProcessor } from '../../hooks/useSongProcessor';

// Route type for this screen
type SongFullscreenRouteProp = RouteProp<RootStackParamList, 'SongFullscreen'>;

export default function SongFullscreenScreen({ route }: { route: SongFullscreenRouteProp }) {
  const { author, key, capo, content } = route.params;
  const { settings } = useSettings();
  const { chordsVisible, fontSize, fontFamily, notation } = settings;

  const { songHtml } = useSongProcessor({
    originalChordPro: content || null,
    currentTranspose: 0,
    chordsVisible,
    currentFontSizeEm: fontSize * 1.6,
    currentFontFamily: fontFamily,
    author,
    key,
    capo,
    notation,
  });

  const webViewRef = useRef<WebView>(null);
  const divRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(false);

  useEffect(() => {
    if (!autoScroll) return;
    const id = setInterval(() => {
      if (Platform.OS === 'web') {
        if (divRef.current) {
          divRef.current.scrollBy({ top: 1 });
        }
      } else {
        webViewRef.current?.injectJavaScript('window.scrollBy(0,1); true;');
      }
    }, 50);
    return () => clearInterval(id);
  }, [autoScroll]);

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? (
        <div ref={divRef} style={styles.webContainer as any} dangerouslySetInnerHTML={{ __html: songHtml }} />
      ) : (
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: songHtml }}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
        />
      )}
      <TouchableOpacity style={styles.scrollButton} onPress={() => setAutoScroll(s => !s)}>
        <MaterialIcons name={autoScroll ? 'pause' : 'play-arrow'} color="#fff" size={28} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  webContainer: {
    width: '100%',
    height: '100%',
    overflowY: 'auto',
    padding: 16,
    boxSizing: 'border-box',
  },
  scrollButton: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    backgroundColor: '#000',
    padding: 12,
    borderRadius: 30,
    opacity: 0.7,
  },
});

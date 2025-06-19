import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, Animated } from 'react-native';
import Slider from '@react-native-community/slider';
import { RouteProp, useNavigation, NavigationProp } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { RootStackParamList } from '../(tabs)/cancionero';
import { useSettings } from '../../contexts/SettingsContext';
import { useSongProcessor } from '../../hooks/useSongProcessor';

// Route type for this screen
type SongFullscreenRouteProp = RouteProp<RootStackParamList, 'SongFullscreen'>;

export default function SongFullscreenScreen({ route }: { route: SongFullscreenRouteProp }) {
  const { author, key, capo, content } = route.params;
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
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
  const [scrollSpeed, setScrollSpeed] = useState(1);
  const [sliderVisible, setSliderVisible] = useState(false);
  const sliderOpacity = useRef(new Animated.Value(0)).current;
  const sliderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showSlider = useCallback(() => {
    setSliderVisible(true);
    Animated.timing(sliderOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    if (sliderTimeoutRef.current) clearTimeout(sliderTimeoutRef.current);
    sliderTimeoutRef.current = setTimeout(() => {
      Animated.timing(sliderOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setSliderVisible(false));
    }, 3000);
  }, [sliderOpacity]);

  useEffect(() => {
    const parent = navigation.getParent();
    parent?.setOptions({ tabBarStyle: { display: 'none' } });
    return () => {
      parent?.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation]);

  useEffect(() => {
    if (!autoScroll) return;
    const id = setInterval(() => {
      if (Platform.OS === 'web') {
        if (divRef.current) {
          divRef.current.scrollBy({ top: scrollSpeed });
        }
      } else {
        webViewRef.current?.injectJavaScript(`window.scrollBy(0,${scrollSpeed}); true;`);
      }
    }, 50);
    return () => clearInterval(id);
  }, [autoScroll, scrollSpeed]);

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
      <TouchableOpacity
        style={styles.scrollButton}
        onPress={() => {
          setAutoScroll(s => !s);
          showSlider();
        }}
      >
        <MaterialIcons name={autoScroll ? 'pause' : 'play-arrow'} color="#fff" size={28} />
      </TouchableOpacity>
      {sliderVisible && (
        <Animated.View style={[styles.sliderWrapper, { opacity: sliderOpacity }]}>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={10}
            value={scrollSpeed}
            onValueChange={value => {
              setScrollSpeed(value);
              showSlider();
            }}
          />
        </Animated.View>
      )}
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
  sliderWrapper: {
    position: 'absolute',
    right: 0,
    bottom: 100,
    transform: [{ rotate: '-90deg' }],
    width: 150,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slider: {
    width: 150,
    height: 40,
  },
});

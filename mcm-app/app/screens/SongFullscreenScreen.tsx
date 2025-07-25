import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
} from 'react-native';
import {
  RouteProp,
  useNavigation,
  NavigationProp,
} from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { RootStackParamList } from '../(tabs)/cancionero';
import { useSettings } from '../../contexts/SettingsContext';
import { useSongProcessor } from '../../hooks/useSongProcessor';
import CrossPlatformSlider from '../../components/CrossPlatformSlider';

// Route type for this screen
type SongFullscreenRouteProp = RouteProp<RootStackParamList, 'SongFullscreen'>;

export default function SongFullscreenScreen({
  route,
}: {
  route: SongFullscreenRouteProp;
}) {
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
  // Slider value ranges from 0 to 1. We'll multiply by `maxSpeed` for the actual
  // pixels scrolled on each interval. Start at 25% of the range.
  const [scrollSpeed, setScrollSpeed] = useState(0.25);
  const maxSpeed = 3; // slightly slower than previous max
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
      const delta = scrollSpeed * maxSpeed;
      if (Platform.OS === 'web') {
        if (divRef.current) {
          divRef.current.scrollBy({ top: delta });
        }
      } else {
        webViewRef.current?.injectJavaScript(
          `window.scrollBy(0,${delta}); true;`,
        );
      }
    }, 50);
    return () => clearInterval(id);
  }, [autoScroll, scrollSpeed]);

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? (
        <div
          ref={divRef}
          style={styles.webContainer as any}
          dangerouslySetInnerHTML={{ __html: songHtml }}
        />
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
          setAutoScroll((s) => !s);
          showSlider();
        }}
      >
        <MaterialIcons
          name={autoScroll ? 'pause' : 'play-arrow'}
          color="#fff"
          size={28}
        />
      </TouchableOpacity>
      {sliderVisible && (
        <Animated.View
          style={[styles.sliderWrapper, { opacity: sliderOpacity }]}
        >
          <CrossPlatformSlider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            step={0.01}
            value={scrollSpeed}
            onValueChange={(value: number) => {
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
    padding: 8,
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
    zIndex: 2,
  },
  sliderWrapper: {
    position: 'absolute',
    right: 20,
    bottom: 80,
    width: 160,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  slider: {
    width: '100%',
    height: 40,
  },
});

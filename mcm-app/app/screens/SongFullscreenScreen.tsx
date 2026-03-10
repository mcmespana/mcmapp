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
import { useColorScheme } from '../../hooks/useColorScheme';
import { Colors } from '../../constants/colors';
import CrossPlatformSlider from '../../components/CrossPlatformSlider';

type SongFullscreenRouteProp = RouteProp<RootStackParamList, 'SongFullscreen'>;

export default function SongFullscreenScreen({
  route,
}: {
  route: SongFullscreenRouteProp;
}) {
  const { author, key, capo, content } = route.params;
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme];
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
    isFullscreen: true,
  });

  const webViewRef = useRef<WebView>(null);
  const divRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(0.25);
  const maxSpeed = 3;
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
    <View style={[styles.container, { backgroundColor: theme.background }]}>
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

      {/* Scroll control button */}
      <TouchableOpacity
        style={[styles.scrollButton, isDark && styles.scrollButtonDark]}
        onPress={() => {
          setAutoScroll((s) => !s);
          showSlider();
        }}
        activeOpacity={0.8}
      >
        <MaterialIcons
          name={autoScroll ? 'pause' : 'play-arrow'}
          color={isDark ? '#EBEBF0' : '#fff'}
          size={26}
        />
      </TouchableOpacity>

      {/* Speed slider */}
      {sliderVisible && (
        <Animated.View
          style={[
            styles.sliderWrapper,
            isDark && styles.sliderWrapperDark,
            { opacity: sliderOpacity },
          ]}
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
  container: { flex: 1 },
  webContainer: {
    width: '100%',
    height: '100%',
    overflowY: 'auto',
    padding: 4,
    boxSizing: 'border-box',
  },
  scrollButton: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    backgroundColor: 'rgba(0,0,0,0.75)',
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
      },
    }),
  },
  scrollButtonDark: {
    backgroundColor: 'rgba(60,60,60,0.85)',
  },
  sliderWrapper: {
    position: 'absolute',
    right: 20,
    bottom: 90,
    width: 160,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  sliderWrapperDark: {
    backgroundColor: 'rgba(60,60,60,0.85)',
  },
  slider: {
    width: '100%',
    height: 40,
  },
});

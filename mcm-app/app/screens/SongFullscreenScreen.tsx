import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Platform, Animated } from 'react-native';
import {
  RouteProp,
  useNavigation,
  NavigationProp,
} from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { BlurView } from 'expo-blur';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Slider, PressableFeedback } from 'heroui-native';
import { RootStackParamList } from '../(tabs)/cancionero';
import { useSettings } from '../../contexts/SettingsContext';
import { useSongProcessor } from '../../hooks/useSongProcessor';
import { useColorScheme } from '../../hooks/useColorScheme';
import { Colors } from '../../constants/colors';

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
    isDark,
  });

  const webViewRef = useRef<WebView>(null);
  const divRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(0.25);
  const maxSpeed = 3;
  const [sliderVisible, setSliderVisible] = useState(false);
  const sliderOpacity = useRef(new Animated.Value(0)).current;
  const sliderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fade-in entry animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

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
    }, 2000);
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

  const isIOS = Platform.OS === 'ios';

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: theme.background, opacity: fadeAnim },
      ]}
    >
      {/* Close button — glass effect */}
      <PressableFeedback
        style={[
          styles.closeButton,
          !isIOS &&
            (isDark
              ? styles.closeButtonDarkFallback
              : styles.closeButtonFallback),
        ]}
        onPress={() => navigation.goBack()}
        accessibilityLabel="Cerrar pantalla completa"
      >
        <PressableFeedback.Scale />
        {isIOS && (
          <BlurView
            tint={isDark ? 'dark' : 'light'}
            intensity={72}
            style={[StyleSheet.absoluteFill, styles.blurFill]}
          />
        )}
        <MaterialIcons
          name="close"
          color={isDark ? '#EBEBF0' : '#fff'}
          size={20}
        />
      </PressableFeedback>

      {/* Song content with horizontal breathing room */}
      <View style={styles.contentWrapper}>
        {Platform.OS === 'web' ? (
          <div
            ref={divRef}
            style={webContainerStyle as any}
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
      </View>

      {/* Vertical speed slider — liquid glass */}
      {sliderVisible && (
        <Animated.View
          style={[
            styles.sliderWrapper,
            !isIOS && styles.sliderWrapperFallback,
            { opacity: sliderOpacity },
          ]}
        >
          {isIOS && (
            <BlurView
              tint={isDark ? 'dark' : 'light'}
              intensity={72}
              style={[StyleSheet.absoluteFill, styles.blurFill]}
            />
          )}
          <Slider
            value={Math.round(scrollSpeed * 100)}
            onChange={(v) => {
              setScrollSpeed((v as number) / 100);
              showSlider();
            }}
            minValue={0}
            maxValue={100}
            step={1}
            orientation="vertical"
            style={styles.sliderControl}
          >
            <Slider.Track>
              <Slider.Fill />
              <Slider.Thumb />
            </Slider.Track>
          </Slider>
        </Animated.View>
      )}

      {/* Play / pause button — liquid glass, semi-transparent when active */}
      <PressableFeedback
        style={[
          styles.scrollButton,
          !isIOS &&
            (isDark
              ? styles.scrollButtonDarkFallback
              : styles.scrollButtonFallback),
          autoScroll && styles.scrollButtonActive,
        ]}
        onPress={() => {
          setAutoScroll((s) => !s);
          showSlider();
        }}
      >
        <PressableFeedback.Scale />
        {isIOS && (
          <BlurView
            tint={isDark ? 'dark' : 'light'}
            intensity={72}
            style={[StyleSheet.absoluteFill, styles.blurFill]}
          />
        )}
        <MaterialIcons
          name={autoScroll ? 'pause' : 'play-arrow'}
          color={isDark ? '#EBEBF0' : '#fff'}
          size={26}
        />
      </PressableFeedback>
    </Animated.View>
  );
}

const webContainerStyle = {
  width: '100%',
  height: '100%',
  overflowY: 'auto',
  paddingHorizontal: 12,
  boxSizing: 'border-box',
} as unknown as React.CSSProperties;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
    marginHorizontal: 12,
    marginTop: 8,
  },
  blurFill: {
    borderRadius: 20,
  },
  /* Close button — top left */
  closeButton: {
    position: 'absolute',
    left: 16,
    top: Platform.OS === 'ios' ? 54 : 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    zIndex: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
    ...Platform.select({
      web: { boxShadow: '0 2px 10px rgba(0,0,0,0.2)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 4,
      },
    }),
  },
  closeButtonFallback: {
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  closeButtonDarkFallback: {
    backgroundColor: 'rgba(60,60,60,0.82)',
  },
  /* Scroll button */
  scrollButton: {
    position: 'absolute',
    right: 20,
    bottom: 36,
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    zIndex: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
    ...Platform.select({
      web: { boxShadow: '0 4px 16px rgba(0,0,0,0.25)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 6,
      },
    }),
  },
  scrollButtonFallback: {
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  scrollButtonDarkFallback: {
    backgroundColor: 'rgba(60,60,60,0.82)',
  },
  scrollButtonActive: {
    opacity: 0.6,
  },
  /* Vertical slider */
  sliderWrapper: {
    position: 'absolute',
    right: 20,
    bottom: 104, // 36 (button bottom) + 52 (button height) + 16 (gap)
    width: 44,
    height: 180,
    borderRadius: 22,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    zIndex: 2,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        backgroundColor: 'rgba(0,0,0,0.45)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 5,
      },
    }),
  },
  sliderWrapperFallback: {
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sliderControl: {
    flex: 1,
    width: '100%',
    paddingVertical: 14,
  },
});

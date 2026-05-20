import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  RouteProp,
  useNavigation,
  NavigationProp,
} from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { BlurView } from 'expo-blur';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { PressableFeedback } from 'heroui-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import { RootStackParamList } from '../(tabs)/cancionero';
import { useSettings } from '../../contexts/SettingsContext';
import { useSongProcessor } from '../../hooks/useSongProcessor';
import { useColorScheme } from '../../hooks/useColorScheme';
import { Colors } from '../../constants/colors';

type SongFullscreenRouteProp = RouteProp<RootStackParamList, 'SongFullscreen'>;

// Pixels per frame at ~60fps
const MIN_SPEED_PPF = 0.1; // ~6 px/s — very slow
const MAX_SPEED_PPF = 3.8; // ~228 px/s — fast

// Injected into WebView on page load — drives rAF scroll loop
const SCROLL_CONTROLLER_JS =
  '(function(){var _v=0,_a=0,_r=null;' +
  'function _t(){_a+=_v;var p=Math.floor(_a);' +
  'if(p>0){window.scrollBy(0,p);_a-=p;}' +
  'if(_v>0){_r=requestAnimationFrame(_t);}else{_r=null;}}' +
  'window.__mcmScroll=function(v){_v=v;if(v>0&&!_r){_r=requestAnimationFrame(_t);}};' +
  '})();true;';

// Vertical slider geometry
const SLIDER_H = 130; // draggable range height (px)
const THUMB_D = 22; // thumb diameter
const DRAG_RANGE = SLIDER_H - THUMB_D;
const TRACK_W = 3;

/**
 * Cross-platform vertical slider built on react-native-gesture-handler +
 * Reanimated. Using RNGH (instead of PanResponder) avoids gesture conflicts
 * with the surrounding heroui-native PressableFeedback components, which is
 * what kept breaking the previous implementation. value: 0..1
 */
function VerticalSlider({
  value,
  onChange,
  onStart,
  onEnd,
}: {
  value: number;
  onChange: (v: number) => void;
  onStart?: () => void;
  onEnd?: () => void;
}) {
  const sv = useSharedValue(value);
  const start = useSharedValue(value);

  useEffect(() => {
    sv.value = value;
  }, [value, sv]);

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => {
      start.value = sv.value;
      if (onStart) runOnJS(onStart)();
    })
    .onUpdate((e) => {
      // dy > 0 = moved down = slower; top = fast (value 1)
      const next = Math.max(
        0,
        Math.min(1, start.value - e.translationY / DRAG_RANGE),
      );
      sv.value = next;
      runOnJS(onChange)(next);
    })
    .onFinalize(() => {
      if (onEnd) runOnJS(onEnd)();
    });

  // Tap on the track to jump to that position.
  const tap = Gesture.Tap().onEnd((e) => {
    const raw = 1 - (e.y - THUMB_D / 2) / DRAG_RANGE;
    const next = Math.max(0, Math.min(1, raw));
    sv.value = next;
    runOnJS(onChange)(next);
    if (onEnd) runOnJS(onEnd)();
  });

  const gesture = Gesture.Exclusive(pan, tap);

  const thumbStyle = useAnimatedStyle(() => ({
    top: (1 - sv.value) * DRAG_RANGE,
  }));
  const fillStyle = useAnimatedStyle(() => ({
    top: (1 - sv.value) * DRAG_RANGE + THUMB_D / 2,
    height: sv.value * DRAG_RANGE,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={sliderStyles.container}
        // Extra hit area so small thumbs are easy to grab
        hitSlop={{ top: 8, bottom: 8, left: 14, right: 14 }}
      >
        {/* Track background */}
        <View style={sliderStyles.trackBg} />
        {/* Filled portion: from thumb down to bottom = the selected speed level */}
        <Reanimated.View style={[sliderStyles.trackFill, fillStyle]} />
        {/* Thumb */}
        <Reanimated.View style={[sliderStyles.thumb, thumbStyle]} />
      </View>
    </GestureDetector>
  );
}

const sliderStyles = StyleSheet.create({
  container: {
    width: THUMB_D,
    height: SLIDER_H,
  },
  trackBg: {
    position: 'absolute',
    top: THUMB_D / 2,
    bottom: THUMB_D / 2,
    left: (THUMB_D - TRACK_W) / 2,
    width: TRACK_W,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: TRACK_W / 2,
  },
  trackFill: {
    position: 'absolute',
    left: (THUMB_D - TRACK_W) / 2,
    width: TRACK_W,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: TRACK_W / 2,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    width: THUMB_D,
    height: THUMB_D,
    borderRadius: THUMB_D / 2,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.35,
        shadowRadius: 3,
        elevation: 3,
      },
    }),
  },
});

// ─────────────────────────────────────────────────────────────────────────────

export default function SongFullscreenScreen({
  route,
}: {
  route: SongFullscreenRouteProp;
}) {
  const { author, key, capo, content, title } = route.params;
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  const { settings } = useSettings();
  const { chordsVisible, fontSize, fontFamily, notation } = settings;

  const { songHtml } = useSongProcessor({
    originalChordPro: content || null,
    currentTranspose: 0,
    chordsVisible,
    currentFontSizeEm: fontSize * 1.6,
    currentFontFamily: fontFamily,
    title,
    author,
    key,
    capo,
    notation,
    isFullscreen: true,
    isDark,
    topInset: Math.max(insets.top, 16) + 56,
    bottomInset: Math.max(insets.bottom, 16) + 96,
  });

  const webViewRef = useRef<WebView>(null);
  const divRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(false);
  const [speedFactor, setSpeedFactor] = useState(0.35);
  const [controlsVisible, setControlsVisible] = useState(false);
  const controlsOpacity = useRef(new Animated.Value(0)).current;
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);

  // Refs for fluid web rAF scroll (avoid stale closures)
  const webRafRef = useRef<number | null>(null);
  const webAccRef = useRef(0);
  const autoScrollRef = useRef(autoScroll);
  const speedFactorRef = useRef(speedFactor);
  autoScrollRef.current = autoScroll;
  speedFactorRef.current = speedFactor;

  // Fade-in entry
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    Animated.timing(controlsOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();

    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    // Don't schedule auto-hide while the user is dragging the slider —
    // hiding mid-drag would unmount the gesture target.
    if (isDraggingRef.current) return;
    hideTimeoutRef.current = setTimeout(() => {
      Animated.timing(controlsOpacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start(() => setControlsVisible(false));
    }, 2400);
  }, [controlsOpacity]);

  const handleSliderStart = useCallback(() => {
    isDraggingRef.current = true;
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
  }, []);
  const handleSliderEnd = useCallback(() => {
    isDraggingRef.current = false;
    showControls();
  }, [showControls]);

  // Web: fluid rAF scroll loop driven from React side
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (webRafRef.current !== null) {
      cancelAnimationFrame(webRafRef.current);
      webRafRef.current = null;
    }
    if (!autoScroll) return;
    webAccRef.current = 0;
    const ppf = MIN_SPEED_PPF + speedFactor * (MAX_SPEED_PPF - MIN_SPEED_PPF);
    const step = () => {
      webAccRef.current += ppf;
      const px = Math.floor(webAccRef.current);
      if (px >= 1) {
        divRef.current?.scrollBy({ top: px });
        webAccRef.current -= px;
      }
      webRafRef.current = requestAnimationFrame(step);
    };
    webRafRef.current = requestAnimationFrame(step);
    return () => {
      if (webRafRef.current !== null) cancelAnimationFrame(webRafRef.current);
    };
  }, [autoScroll, speedFactor]);

  // Native WebView: send velocity to injected rAF controller
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const ppf = MIN_SPEED_PPF + speedFactor * (MAX_SPEED_PPF - MIN_SPEED_PPF);
    webViewRef.current?.injectJavaScript(
      `if(window.__mcmScroll)window.__mcmScroll(${autoScroll ? ppf : 0});true;`,
    );
  }, [autoScroll, speedFactor]);

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  // Re-apply velocity after WebView reloads (e.g. when songHtml changes)
  const handleWebViewLoad = useCallback(() => {
    if (!autoScrollRef.current) return;
    const ppf =
      MIN_SPEED_PPF + speedFactorRef.current * (MAX_SPEED_PPF - MIN_SPEED_PPF);
    webViewRef.current?.injectJavaScript(
      `if(window.__mcmScroll)window.__mcmScroll(${ppf});true;`,
    );
  }, []);

  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';
  const closeTop = Math.max(insets.top, 12) + 8;
  const controlsBottom = Math.max(insets.bottom, 12) + 16;

  const speedLabel = (() => {
    if (speedFactor < 0.2) return 'Lento';
    if (speedFactor < 0.55) return 'Normal';
    if (speedFactor < 0.85) return 'Rápido';
    return 'Muy rápido';
  })();

  const TranslucentBg = ({ style }: { style?: object }) =>
    isIOS ? (
      <>
        <BlurView
          tint={isDark ? 'dark' : 'light'}
          intensity={60}
          style={[StyleSheet.absoluteFill, style]}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: isDark
                ? 'rgba(20,20,22,0.35)'
                : 'rgba(0,0,0,0.22)',
            },
            style,
          ]}
        />
      </>
    ) : (
      <View
        style={[
          StyleSheet.absoluteFill,
          isWeb
            ? ({
                backgroundColor: isDark
                  ? 'rgba(28,28,30,0.55)'
                  : 'rgba(0,0,0,0.42)',
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
              } as any)
            : {
                backgroundColor: isDark
                  ? 'rgba(40,40,42,0.82)'
                  : 'rgba(0,0,0,0.62)',
              },
          style,
        ]}
      />
    );

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: theme.background, opacity: fadeAnim },
      ]}
    >
      {/* Song content — fills the screen; padding applied inside HTML */}
      <View style={styles.contentWrapper}>
        {isWeb ? (
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
            style={{ flex: 1, backgroundColor: 'transparent' }}
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="never"
            automaticallyAdjustContentInsets={false}
            injectedJavaScript={SCROLL_CONTROLLER_JS}
            onLoadEnd={handleWebViewLoad}
          />
        )}
      </View>

      {/* Close button — top right */}
      <PressableFeedback
        style={[styles.closeButton, { top: closeTop }]}
        onPress={() => navigation.goBack()}
        accessibilityLabel="Cerrar pantalla completa"
      >
        <PressableFeedback.Scale />
        <TranslucentBg style={{ borderRadius: 20 }} />
        <MaterialIcons name="close" color="#FFFFFF" size={22} />
      </PressableFeedback>

      {/* Controls cluster — bottom right, vertical stack */}
      <View
        style={[styles.controlsCluster, { bottom: controlsBottom }]}
        pointerEvents="box-none"
      >
        {/* Speed slider — appears above play button when controls are visible */}
        {controlsVisible && (
          <Animated.View
            style={[styles.speedPill, { opacity: controlsOpacity }]}
            pointerEvents="auto"
          >
            <TranslucentBg style={{ borderRadius: 24 }} />
            <Text style={styles.speedLabel} numberOfLines={1}>
              {speedLabel}
            </Text>
            <VerticalSlider
              value={speedFactor}
              onChange={setSpeedFactor}
              onStart={handleSliderStart}
              onEnd={handleSliderEnd}
            />
          </Animated.View>
        )}

        {/* Play / pause */}
        <PressableFeedback
          style={styles.playButton}
          onPress={() => {
            setAutoScroll((s: boolean) => !s);
            showControls();
          }}
          onLongPress={() => showControls()}
          accessibilityLabel={autoScroll ? 'Pausar scroll' : 'Iniciar scroll'}
        >
          <PressableFeedback.Scale />
          <TranslucentBg style={{ borderRadius: 28 }} />
          <MaterialIcons
            name={autoScroll ? 'pause' : 'play-arrow'}
            color="#FFFFFF"
            size={28}
          />
        </PressableFeedback>
      </View>
    </Animated.View>
  );
}

const webContainerStyle = {
  width: '100%',
  height: '100%',
  overflowY: 'auto',
  boxSizing: 'border-box',
} as unknown as React.CSSProperties;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
  },
  /* Close — top right */
  closeButton: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    zIndex: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    ...Platform.select({
      web: { boxShadow: '0 2px 10px rgba(0,0,0,0.25)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 5,
      },
    }),
  },
  /* Column cluster at bottom right */
  controlsCluster: {
    position: 'absolute',
    right: 16,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    zIndex: 3,
  },
  /* Vertical speed slider pill */
  speedPill: {
    width: 52,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 26,
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    ...Platform.select({
      web: { boxShadow: '0 4px 18px rgba(0,0,0,0.28)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 10,
        elevation: 7,
      },
    }),
  },
  speedLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  /* Play / pause */
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    ...Platform.select({
      web: { boxShadow: '0 4px 18px rgba(0,0,0,0.28)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 10,
        elevation: 7,
      },
    }),
  },
});

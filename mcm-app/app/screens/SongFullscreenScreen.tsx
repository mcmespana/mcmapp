import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Platform, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Animated,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
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
import { RootStackParamList } from '../(tabs)/cancionero';
import { useSettings } from '../../contexts/SettingsContext';
import { useSongProcessor } from '../../hooks/useSongProcessor';
import { useColorScheme } from '../../hooks/useColorScheme';
import { Colors } from '../../constants/colors';

type SongFullscreenRouteProp = RouteProp<RootStackParamList, 'SongFullscreen'>;

const MIN_SPEED_PPT = 0.5;
const MAX_SPEED_PPT = 7;
const TICK_MS = 50;

// Vertical slider geometry
const SLIDER_H = 130; // draggable range height (px)
const THUMB_D = 22; // thumb diameter
const DRAG_RANGE = SLIDER_H - THUMB_D;
const TRACK_W = 3;

/** Cross-platform vertical slider via PanResponder. value: 0..1 */
function VerticalSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const valueRef = useRef(value);
  const startRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRef.current = valueRef.current;
      },
      onPanResponderMove: (_evt: GestureResponderEvent, { dy }: PanResponderGestureState) => {
        // dy > 0 = moved down = slower; top = fast (value 1)
        const next = Math.max(0, Math.min(1, startRef.current - dy / DRAG_RANGE));
        onChange(next);
      },
    }),
  ).current;

  const thumbTop = (1 - value) * DRAG_RANGE;

  return (
    <View
      style={sliderStyles.container}
      {...panResponder.panHandlers}
      // Extra hit area so small thumbs are easy to grab
      hitSlop={{ top: 8, bottom: 8, left: 14, right: 14 }}
    >
      {/* Track background */}
      <View style={sliderStyles.trackBg} />
      {/* Filled portion: from thumb down to bottom = the selected speed level */}
      <View
        style={[
          sliderStyles.trackFill,
          {
            top: thumbTop + THUMB_D / 2,
            height: value * DRAG_RANGE,
          },
        ]}
      />
      {/* Thumb */}
      <View style={[sliderStyles.thumb, { top: thumbTop }]} />
    </View>
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
  const { author, key, capo, content } = route.params;
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();
  const theme = Colors[scheme ?? 'light'];
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
    hideTimeoutRef.current = setTimeout(() => {
      Animated.timing(controlsOpacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start(() => setControlsVisible(false));
    }, 2400);
  }, [controlsOpacity]);

  useEffect(() => {
    const parent = navigation.getParent();
    parent?.setOptions({ tabBarStyle: { display: 'none' } });
    return () => {
      parent?.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation]);

  useEffect(() => {
    if (!autoScroll) return;
    const speedPpt =
      MIN_SPEED_PPT + speedFactor * (MAX_SPEED_PPT - MIN_SPEED_PPT);
    const id = setInterval(() => {
      if (Platform.OS === 'web') {
        divRef.current?.scrollBy({ top: speedPpt });
      } else {
        webViewRef.current?.injectJavaScript(
          `window.scrollBy(0,${speedPpt}); true;`,
        );
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [autoScroll, speedFactor]);

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
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
      {/* Close button — glass effect */}
      <PressableFeedback
        style={[
          styles.closeButton,
          { top: insets.top + 8 },
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
              onChange={(v) => {
                setSpeedFactor(v);
                showControls();
              }}
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

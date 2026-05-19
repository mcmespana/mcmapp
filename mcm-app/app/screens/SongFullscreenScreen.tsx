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
import { Slider, PressableFeedback } from 'heroui-native';
import { RootStackParamList } from '../(tabs)/cancionero';
import { useSettings } from '../../contexts/SettingsContext';
import { useSongProcessor } from '../../hooks/useSongProcessor';
import { useColorScheme } from '../../hooks/useColorScheme';
import { Colors } from '../../constants/colors';

type SongFullscreenRouteProp = RouteProp<RootStackParamList, 'SongFullscreen'>;

// Rango de velocidades del auto-scroll, en píxeles por tick (50ms = 20 ticks/s).
// - MIN: lectura muy lenta a ritmo de canto (≈10 px/s).
// - MAX: scroll rápido cuando ya conoces la letra (≈140 px/s).
const MIN_SPEED_PPT = 0.5;
const MAX_SPEED_PPT = 7;
const TICK_MS = 50;

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
  const insets = useSafeAreaInsets();
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
    topInset: Math.max(insets.top, 16) + 56, // notch + close button
    bottomInset: Math.max(insets.bottom, 16) + 96, // home indicator + play button
  });

  const webViewRef = useRef<WebView>(null);
  const divRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(false);
  // Factor 0..1 del slider. La velocidad real interpola entre MIN y MAX.
  const [speedFactor, setSpeedFactor] = useState(0.35);
  const [controlsVisible, setControlsVisible] = useState(false);
  const controlsOpacity = useRef(new Animated.Value(0)).current;
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fade-in entry animation
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
        if (divRef.current) {
          divRef.current.scrollBy({ top: speedPpt });
        }
      } else {
        webViewRef.current?.injectJavaScript(
          `window.scrollBy(0,${speedPpt}); true;`,
        );
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [autoScroll, speedFactor]);

  // Limpieza del timer al desmontar
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';
  const closeTop = Math.max(insets.top, 12) + 8;
  const controlsBottom = Math.max(insets.bottom, 12) + 16;

  // Etiqueta legible para la velocidad
  const speedLabel = (() => {
    if (speedFactor < 0.2) return 'Lento';
    if (speedFactor < 0.55) return 'Normal';
    if (speedFactor < 0.85) return 'Rápido';
    return 'Muy rápido';
  })();

  const TranslucentBg = ({ style }: { style?: any }) =>
    isIOS ? (
      <>
        <BlurView
          tint={isDark ? 'dark' : 'light'}
          intensity={60}
          style={[StyleSheet.absoluteFill, styles.absFill, style]}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.absFill,
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
          styles.absFill,
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
      {/* Contenido — ocupa toda la pantalla; el padding superior/inferior
          se aplica dentro del HTML (vía useSongProcessor) para que el
          contenido pueda hacer scroll bajo los botones translúcidos. */}
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
        <TranslucentBg style={{ borderRadius: 18 }} />
        <MaterialIcons
          name="close"
          color={isDark ? '#FFFFFF' : '#FFFFFF'}
          size={22}
        />
      </PressableFeedback>

      {/* Controles inferiores — siempre translúcidos para no tapar texto. */}
      <View
        style={[
          styles.controlsCluster,
          { bottom: controlsBottom },
        ]}
        pointerEvents="box-none"
      >
        {/* Speed pill (slider + label) — aparece a la izquierda del play */}
        {controlsVisible && (
          <Animated.View
            style={[
              styles.speedPill,
              { opacity: controlsOpacity },
            ]}
            pointerEvents="auto"
          >
            <TranslucentBg style={{ borderRadius: 22 }} />
            <Text style={styles.speedLabel} numberOfLines={1}>
              {speedLabel}
            </Text>
            <View style={styles.speedSliderWrap}>
              <Slider
                value={Math.round(speedFactor * 100)}
                onChange={(v) => {
                  setSpeedFactor((v as number) / 100);
                  showControls();
                }}
                minValue={0}
                maxValue={100}
                step={1}
                style={styles.speedSlider}
              >
                <Slider.Track>
                  <Slider.Fill />
                  <Slider.Thumb />
                </Slider.Track>
              </Slider>
            </View>
          </Animated.View>
        )}

        {/* Play / pause — siempre visible, translúcido */}
        <PressableFeedback
          style={styles.playButton}
          onPress={() => {
            setAutoScroll((s) => !s);
            showControls();
          }}
          onLongPress={() => showControls()}
          accessibilityLabel={autoScroll ? 'Pausar scroll' : 'Iniciar scroll'}
        >
          <PressableFeedback.Scale />
          <TranslucentBg style={{ borderRadius: 26 }} />
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
  absFill: {
    borderRadius: 22,
  },
  /* Close button — top right */
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
      web: { boxShadow: '0 2px 10px rgba(0,0,0,0.25)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 5,
      },
    }),
  },
  /* Bottom-right cluster: speed pill + play button */
  controlsCluster: {
    position: 'absolute',
    right: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    zIndex: 3,
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
      web: { boxShadow: '0 4px 18px rgba(0,0,0,0.28)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 10,
        elevation: 7,
      },
    }),
  },
  /* Speed pill */
  speedPill: {
    flexShrink: 1,
    minWidth: 200,
    maxWidth: 320,
    height: 44,
    borderRadius: 22,
    paddingLeft: 14,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    ...Platform.select({
      web: { boxShadow: '0 4px 18px rgba(0,0,0,0.25)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 10,
        elevation: 6,
      },
    }),
  },
  speedLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    minWidth: 64,
  },
  speedSliderWrap: {
    flex: 1,
    height: 32,
    justifyContent: 'center',
  },
  speedSlider: {
    width: '100%',
  },
});

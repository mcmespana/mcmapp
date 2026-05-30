import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Animated,
  Pressable,
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
import * as Haptics from 'expo-haptics';
import { PressableFeedback } from 'heroui-native';
import { RootStackParamList } from '../(tabs)/cancionero';
import { useSettings } from '../../contexts/SettingsContext';
import { hasArrangements } from '../../utils/arrangements';
import { useSongProcessor } from '../../hooks/useSongProcessor';
import { useColorScheme } from '../../hooks/useColorScheme';
import { Colors } from '../../constants/colors';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import {
  AUTO_SCROLL_SPEEDS,
  AUTO_SCROLL_CONTROLLER_JS,
  useAutoScroller,
} from '@/hooks/useAutoScroller';

type SongFullscreenRouteProp = RouteProp<RootStackParamList, 'SongFullscreen'>;

const isIOS = Platform.OS === 'ios';
const isWeb = Platform.OS === 'web';

const triggerHaptic = (style: Haptics.ImpactFeedbackStyle) => {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(style).catch(() => {});
};

// ─── Controles de auto-scroll (segmented + play) ─────────────────────────────

interface AutoScrollControlsProps {
  isPlaying: boolean;
  speedIndex: number;
  onToggle: () => void;
  onSelectSpeed: (i: number) => void;
  isDark: boolean;
  bottom: number;
}

function AutoScrollControls({
  isPlaying,
  speedIndex,
  onToggle,
  onSelectSpeed,
  isDark,
  bottom,
}: AutoScrollControlsProps) {
  const [expanded, setExpanded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    cancelHideTimer();
    hideTimerRef.current = setTimeout(() => setExpanded(false), 3200);
  }, [cancelHideTimer]);

  const showPicker = useCallback(() => {
    setExpanded(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: expanded ? 1 : 0,
      duration: expanded ? 180 : 240,
      useNativeDriver: true,
    }).start();
    if (!expanded) cancelHideTimer();
  }, [expanded, fadeAnim, cancelHideTimer]);

  useEffect(() => () => cancelHideTimer(), [cancelHideTimer]);

  const handlePlay = useCallback(() => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    onToggle();
    // Al iniciar reproducción mostramos brevemente el selector como pista visual.
    if (!isPlaying) showPicker();
  }, [onToggle, isPlaying, showPicker]);

  const handleSelectSpeed = useCallback(
    (i: number) => {
      if (i !== speedIndex) triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
      onSelectSpeed(i);
      showPicker();
    },
    [onSelectSpeed, speedIndex, showPicker],
  );

  const currentLabel = AUTO_SCROLL_SPEEDS[speedIndex].label;

  return (
    <View style={[styles.controlsCluster, { bottom }]} pointerEvents="box-none">
      {/* Selector de velocidad — pill horizontal, sólo visible al interactuar */}
      <Animated.View
        style={[styles.speedPanel, { opacity: fadeAnim }]}
        pointerEvents={expanded ? 'auto' : 'none'}
      >
        <TranslucentBg isDark={isDark} style={styles.speedPanelBg} />
        <Text style={styles.speedHeading} numberOfLines={1}>
          {currentLabel}
        </Text>
        <View
          style={styles.segmentRow}
          accessibilityRole="adjustable"
          accessibilityLabel={`Velocidad de auto-scroll: ${currentLabel}`}
        >
          {AUTO_SCROLL_SPEEDS.map((s, i) => {
            const selected = i === speedIndex;
            return (
              <Pressable
                key={s.label}
                style={({ pressed }) => [
                  styles.segment,
                  selected && styles.segmentSelected,
                  pressed && styles.segmentPressed,
                ]}
                onPress={() => handleSelectSpeed(i)}
                hitSlop={6}
                accessibilityLabel={s.label}
                accessibilityState={{ selected }}
              >
                <Text
                  style={[
                    styles.segmentText,
                    selected && styles.segmentTextSelected,
                  ]}
                >
                  {i + 1}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      {/* Play / Pause + acceso al selector con long-press */}
      <PressableFeedback
        style={styles.playButton}
        onPress={handlePlay}
        onLongPress={() => {
          triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
          showPicker();
        }}
        accessibilityLabel={
          isPlaying ? 'Pausar desplazamiento' : 'Iniciar desplazamiento'
        }
        accessibilityRole="button"
      >
        <PressableFeedback.Scale />
        <TranslucentBg isDark={isDark} style={styles.playButtonBg} />
        <MaterialIcons
          name={isPlaying ? 'pause' : 'play-arrow'}
          color="#FFFFFF"
          size={28}
        />
        {/* Indicador discreto del nivel actual sobre el botón */}
        <View style={styles.levelBadge} pointerEvents="none">
          <Text style={styles.levelBadgeText}>{speedIndex + 1}</Text>
        </View>
      </PressableFeedback>
    </View>
  );
}

// ─── Fondo translúcido reutilizable ──────────────────────────────────────────

function TranslucentBg({ isDark, style }: { isDark: boolean; style?: object }) {
  if (isIOS) {
    return (
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
    );
  }
  return (
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
}

// ─── Pantalla ────────────────────────────────────────────────────────────────

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

  // Web: F y Esc salen del modo presentación.
  useKeyboardShortcut('f', () => navigation.goBack());
  useKeyboardShortcut('escape', () => navigation.goBack(), {
    preventDefault: false,
  });

  const { settings } = useSettings();
  const { chordsVisible, fontSize, fontFamily, notation } = settings;

  // En presentación mostramos los arreglos siempre que la canción los tenga.
  const songHasArrangements = useMemo(
    () => hasArrangements(content),
    [content],
  );

  const { songHtml, styleState } = useSongProcessor({
    originalChordPro: content || null,
    currentTranspose: 0,
    chordsVisible,
    arrangementsVisible: songHasArrangements,
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

  const webViewRef = useRef<WebView | null>(null);
  const webContainerRef = useRef<HTMLDivElement | null>(null);

  // Push live style updates (font size, theme, etc.) into the WebView/iframe
  // without rebuilding the HTML. Mirrors SongDisplay's bridge.
  useEffect(() => {
    if (!styleState) return;
    const payload = JSON.stringify(styleState);
    if (isWeb) {
      const container = webContainerRef.current;
      // Direct DOM: apply the style on the rendered div since there's no iframe
      // sandbox here. The bootstrap script inside songHtml already exposes the
      // helper on window, but the contentful div lives in the parent document,
      // so we apply CSS variables / classes directly.
      if (!container) return;
      try {
        const r = container.style as CSSStyleDeclaration;
        r.setProperty('--song-font-size', `${styleState.fontSize}em`);
        r.setProperty('--song-font-family', styleState.fontFamily);
        r.setProperty('--song-pad-top', `${styleState.topPadding}px`);
        r.setProperty('--song-pad-bottom', `${styleState.bottomPadding}px`);
      } catch {
        /* noop */
      }
      return;
    }
    if (!webViewRef.current) return;
    const js = `(function(){try{var s=${payload};if(window.__SONG_BRIDGE__){window.__SONG_BRIDGE__.apply(s);}}catch(_){};true;})();`;
    webViewRef.current.injectJavaScript(js);
  }, [styleState]);

  const autoScroll = useAutoScroller({
    webViewRef,
    webContainerRef,
  });

  // Atajos de teclado: espacio = play/pause, ↑/↓ = subir/bajar velocidad.
  useKeyboardShortcut(' ', () => autoScroll.toggle());
  useKeyboardShortcut('arrowup', () =>
    autoScroll.setSpeedIndex(autoScroll.speedIndex + 1),
  );
  useKeyboardShortcut('arrowdown', () =>
    autoScroll.setSpeedIndex(autoScroll.speedIndex - 1),
  );

  // Fade-in de entrada
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const closeTop = Math.max(insets.top, 12) + 8;
  const controlsBottom = Math.max(insets.bottom, 12) + 16;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: theme.background, opacity: fadeAnim },
      ]}
    >
      {/* Contenido de la canción */}
      <View style={styles.contentWrapper}>
        {isWeb ? (
          <div
            ref={webContainerRef}
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
            injectedJavaScript={AUTO_SCROLL_CONTROLLER_JS}
            onLoadEnd={autoScroll.handleWebViewLoad}
            onMessage={autoScroll.handleWebViewMessage}
          />
        )}
      </View>

      {/* Cerrar — esquina superior derecha */}
      <PressableFeedback
        style={[styles.closeButton, { top: closeTop }]}
        onPress={() => navigation.goBack()}
        accessibilityLabel="Cerrar pantalla completa"
      >
        <PressableFeedback.Scale />
        <TranslucentBg isDark={isDark} style={{ borderRadius: 20 }} />
        <MaterialIcons name="close" color="#FFFFFF" size={22} />
      </PressableFeedback>

      {/* Controles de auto-scroll — esquina inferior derecha */}
      <AutoScrollControls
        isPlaying={autoScroll.isPlaying}
        speedIndex={autoScroll.speedIndex}
        onToggle={autoScroll.toggle}
        onSelectSpeed={autoScroll.setSpeedIndex}
        isDark={isDark}
        bottom={controlsBottom}
      />
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
  /* Cerrar — superior derecha */
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
  /* Cluster inferior derecha */
  controlsCluster: {
    position: 'absolute',
    right: 16,
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 10,
    zIndex: 3,
  },
  /* Panel horizontal con selector de velocidad */
  speedPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    gap: 10,
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
  speedPanelBg: {
    borderRadius: 22,
  },
  speedHeading: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    minWidth: 64,
    textAlign: 'right',
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  segment: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  segmentSelected: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  segmentPressed: {
    opacity: 0.7,
  },
  segmentText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '700',
  },
  segmentTextSelected: {
    color: '#1C1C1E',
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
  playButtonBg: {
    borderRadius: 28,
  },
  /* Pequeño badge con el nivel actual sobre el botón de play */
  levelBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelBadgeText: {
    color: '#1C1C1E',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
});

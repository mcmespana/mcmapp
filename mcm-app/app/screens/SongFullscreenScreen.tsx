import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  RouteProp,
  useNavigation,
  NavigationProp,
} from 'expo-router/react-navigation';
import { WebView } from 'react-native-webview';
import { BlurView } from 'expo-blur';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { PressableFeedback } from 'heroui-native';
import { RootStackParamList } from '../(tabs)/cancionero';
import { useChoirSession } from '@/contexts/ChoirSessionContext';
import { useSelectedSongs } from '@/contexts/SelectedSongsContext';
import { h } from '@/utils/haptics';
import { resolveFullscreenSong } from '@/utils/fullscreenSong';
import { useSettings } from '../../contexts/SettingsContext';
import { trackEvent } from '@/utils/analytics';
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
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useSuppressCarismochito } from '@/hooks/useSuppressCarismochito';

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
  const fadeAnim = useSharedValue(0);
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
    fadeAnim.set(
      withTiming(expanded ? 1 : 0, {
        duration: expanded ? 180 : 240,
      }),
    );
    if (!expanded) cancelHideTimer();
  }, [expanded, fadeAnim, cancelHideTimer]);

  const panelStyle = useAnimatedStyle(() => ({ opacity: fadeAnim.get() }));

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
        style={[styles.speedPanel, panelStyle]}
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
  useSuppressCarismochito();
  const params = route.params;
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const choir = useChoirSession();
  const { getSelectedSong } = useSelectedSongs();

  // ── Qué canción se ve ─────────────────────────────────────────────────────
  // Con lista (categoría, etiqueta o playlist) se pasa de una a otra sin
  // salir; en el coro, quien escucha ve la que tiene el líder.
  const list = params.navigationList;
  const [index, setIndex] = useState<number | null>(
    list && typeof params.currentIndex === 'number'
      ? params.currentIndex
      : null,
  );
  const remote = choir.mode === 'slave' ? choir.session?.current : null;
  const selectedNow = getSelectedSong(
    remote?.filename ??
      (list && index !== null ? list[index].filename : params.filename),
  );
  const view = useMemo(
    () =>
      resolveFullscreenSong({
        initial: params,
        list,
        index,
        choirSong: remote,
        choirOverrideTranspose: choir.overrideTranspose,
        selected: selectedNow,
      }),
    [params, list, index, remote, choir.overrideTranspose, selectedNow],
  );
  const { song, following, transpose, capoOverride, capo } = view;
  const { author, key, content } = song;
  // En las listas el título lleva el número delante («18. Alegre…»).
  const title = song.title?.replace(/^\d+\.\s*/, '');
  const canNavigate = !following && !!list && index !== null && list.length > 1;

  const go = useCallback(
    (dir: number) => {
      if (following || !list || index === null) return;
      const next = index + dir;
      if (next < 0 || next >= list.length) {
        h.limit();
        return;
      }
      h.navigate();
      setIndex(next);
    },
    [following, list, index],
  );

  // Coro - LÍDER: la canción que pasa aquí la ven todos.
  useEffect(() => {
    if (choir.mode !== 'master' || index === null || !list) return;
    if (index === params.currentIndex) return;
    void choir.publishCurrent({
      filename: song.filename,
      transpose,
      capoOverride,
      screen: 'fullscreen',
      title: song.title,
      author: song.author,
      songKey: song.key,
      capo: song.capo,
      content: song.content,
    });
    // Solo al cambiar de canción.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Al salir, el detalle queda en la canción a la que se haya llegado.
  const close = useCallback(() => {
    const moved = following
      ? song.filename !== params.filename
      : index !== null && index !== params.currentIndex;
    const nav = navigation as unknown as {
      popTo?: (name: string, p: object, o: { merge: boolean }) => void;
    };
    if (moved && nav.popTo) {
      nav.popTo(
        'SongDetail',
        {
          filename: song.filename,
          title: song.title,
          author: song.author,
          key: song.key,
          capo: song.capo,
          content: song.content ?? '',
          media: song.media,
          navigationList: following ? undefined : list,
          currentIndex: following ? undefined : (index ?? undefined),
          source: params.source,
          firebaseCategory: following ? remote?.firebaseCategory : undefined,
        },
        { merge: false },
      );
      return;
    }
    navigation.goBack();
  }, [following, song, params, index, list, navigation, remote]);
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];

  // Web: F y Esc salen del modo presentación.
  useKeyboardShortcut('f', close);
  useKeyboardShortcut('escape', close, {
    preventDefault: false,
  });

  useEffect(() => {
    trackEvent('modo_presentacion');
  }, []);

  const { settings, setSettings } = useSettings();
  const {
    chordsVisible,
    fontSize,
    fontFamily,
    notation,
    compactView,
    verseNumbers,
    chorusStyle,
    chorusLabel,
    airy,
    pagedFullscreen,
  } = settings;
  // Modo atril: páginas en vez de scroll (también en web: un portátil con
  // pedal es un atril).
  const paged = pagedFullscreen;

  // En presentación mostramos los arreglos siempre que la canción los tenga.
  const songHasArrangements = useMemo(
    () => hasArrangements(content),
    [content],
  );

  const { songHtml, styleState } = useSongProcessor({
    originalChordPro: content || null,
    currentTranspose: transpose,
    chordsVisible,
    arrangementsVisible: songHasArrangements,
    compact: compactView,
    verseNumbers,
    chorusStyle,
    chorusLabel,
    airy,
    paged,
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
  // Web: la canción va en un iframe (como en el detalle) para que corra el
  // script de la hoja (cortes, columnas, páginas). El auto-scroll mueve su
  // documento.
  const webContainerRef = useRef<HTMLElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [webDocKey, setWebDocKey] = useState(0);

  // Push live style updates (font size, theme, etc.) into the WebView/iframe
  // without rebuilding the HTML. Mirrors SongDisplay's bridge.
  useEffect(() => {
    if (!styleState) return;
    const payload = JSON.stringify(styleState);
    if (isWeb) {
      try {
        iframeRef.current?.contentWindow?.postMessage(payload, '*');
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
    webContainerRef:
      webContainerRef as React.MutableRefObject<HTMLDivElement | null>,
    webKey: webDocKey,
  });

  // Mensajes de la hoja: pasar de canción (fin de página, deslizar, flechas)
  // y los del auto-scroll.
  const handleMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg && msg.type === 'sheet-nav') {
          go(msg.dir > 0 ? 1 : -1);
          return;
        }
      } catch {
        /* no es nuestro */
      }
      autoScroll.handleWebViewMessage(event);
    },
    [go, autoScroll],
  );
  useEffect(() => {
    if (!isWeb) return;
    const onWindowMessage = (ev: MessageEvent) => {
      if (ev.source !== iframeRef.current?.contentWindow) return;
      if (typeof ev.data === 'string')
        handleMessage({ nativeEvent: { data: ev.data } });
    };
    window.addEventListener('message', onWindowMessage);
    return () => window.removeEventListener('message', onWindowMessage);
  }, [handleMessage]);
  const handleIframeLoad = () => {
    const frame = iframeRef.current;
    const doc = frame?.contentDocument;
    if (!frame || !doc) return;
    webContainerRef.current = (doc.scrollingElement as HTMLElement) ?? null;
    setWebDocKey((k) => k + 1);
    try {
      frame.contentWindow?.postMessage(JSON.stringify(styleState), '*');
    } catch {
      /* noop */
    }
    // Con el foco dentro de la canción, Esc y F también salen.
    doc.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'f' || e.key === 'F') close();
    });
  };

  // Al pasar a páginas, el scroll automático no pinta nada.
  const { pause: pauseAutoScroll } = autoScroll;
  useEffect(() => {
    if (paged) pauseAutoScroll();
  }, [paged, pauseAutoScroll]);
  const togglePaged = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setSettings({ pagedFullscreen: !pagedFullscreen });
  };

  // Atajos de teclado: espacio = play/pause, ↑/↓ = subir/bajar velocidad.
  useKeyboardShortcut(' ', () => autoScroll.toggle());
  useKeyboardShortcut('arrowup', () =>
    autoScroll.setSpeedIndex(autoScroll.speedIndex + 1),
  );
  useKeyboardShortcut('arrowdown', () =>
    autoScroll.setSpeedIndex(autoScroll.speedIndex - 1),
  );

  // Fade-in de entrada
  const fadeAnim = useSharedValue(0);
  useEffect(() => {
    fadeAnim.set(withTiming(1, { duration: 400 }));
  }, [fadeAnim]);

  const screenStyle = useAnimatedStyle(() => ({ opacity: fadeAnim.get() }));

  const closeTop = Math.max(insets.top, 12) + 8;
  const controlsBottom = Math.max(insets.bottom, 12) + 16;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: theme.background },
        screenStyle,
      ]}
    >
      {/* Contenido de la canción */}
      <View style={styles.contentWrapper}>
        {isWeb ? (
          <iframe
            ref={iframeRef}
            srcDoc={songHtml}
            onLoad={handleIframeLoad}
            title={title ? `Canción: ${title}` : 'Canción'}
            style={webFrameStyle}
          />
        ) : (
          <WebView
            ref={webViewRef}
            // Como en el detalle: el HTML va inline y no se navega a ningún
            // sitio (el contenido viene de Firebase, ver docs/SEGURIDAD.md).
            originWhitelist={['about:blank']}
            onShouldStartLoadWithRequest={(req) => req.url === 'about:blank'}
            source={{ html: songHtml }}
            style={{ flex: 1, backgroundColor: 'transparent' }}
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="never"
            automaticallyAdjustContentInsets={false}
            injectedJavaScript={AUTO_SCROLL_CONTROLLER_JS}
            onLoadEnd={autoScroll.handleWebViewLoad}
            onMessage={handleMessage}
          />
        )}
      </View>

      {/* Cerrar — esquina superior derecha */}
      <PressableFeedback
        style={[styles.closeButton, { top: closeTop }]}
        onPress={close}
        accessibilityLabel="Cerrar pantalla completa"
      >
        <PressableFeedback.Scale />
        <TranslucentBg isDark={isDark} style={{ borderRadius: radii.xl }} />
        <MaterialIcons name="close" color="#FFFFFF" size={22} />
      </PressableFeedback>

      {/* Pasar de canción (lista) o aviso de que se sigue al líder del coro. */}
      {canNavigate && (
        <View
          style={[styles.navCluster, { bottom: controlsBottom }]}
          accessibilityRole="toolbar"
        >
          <TranslucentBg isDark={isDark} style={{ borderRadius: radii.xl }} />
          <PressableFeedback
            style={styles.navButton}
            onPress={() => go(-1)}
            accessibilityRole="button"
            isDisabled={index === 0}
            accessibilityLabel="Canción anterior"
          >
            <MaterialIcons
              name="chevron-left"
              size={28}
              color={index === 0 ? 'rgba(255,255,255,0.35)' : '#FFFFFF'}
            />
          </PressableFeedback>
          <Text style={styles.navCount}>
            {index! + 1} / {list!.length}
          </Text>
          <PressableFeedback
            style={styles.navButton}
            onPress={() => go(1)}
            accessibilityRole="button"
            isDisabled={index === list!.length - 1}
            accessibilityLabel="Canción siguiente"
          >
            <MaterialIcons
              name="chevron-right"
              size={28}
              color={
                index === list!.length - 1
                  ? 'rgba(255,255,255,0.35)'
                  : '#FFFFFF'
              }
            />
          </PressableFeedback>
        </View>
      )}
      {following && (
        <View
          style={[
            styles.navCluster,
            styles.followPill,
            { bottom: controlsBottom },
          ]}
          accessibilityLabel="Siguiendo la canción del coro"
        >
          <TranslucentBg isDark={isDark} style={{ borderRadius: radii.xl }} />
          <MaterialIcons name="groups" size={18} color="#FFFFFF" />
          <Text style={styles.navCount}>Siguiendo al coro</Text>
        </View>
      )}

      {/* Modo atril (páginas) — encima del play. */}
      <PressableFeedback
        style={[
          styles.pagedButton,
          { bottom: controlsBottom + (paged ? 0 : 56 + 12) },
        ]}
        onPress={togglePaged}
        accessibilityRole="switch"
        accessibilityState={{ checked: paged }}
        accessibilityLabel={
          paged
            ? 'Volver al scroll'
            : 'Modo atril: pasar página con un toque o un pedal'
        }
      >
        <PressableFeedback.Scale />
        <TranslucentBg isDark={isDark} style={{ borderRadius: radii.xl }} />
        <MaterialIcons
          name={paged ? 'swap-vert' : 'auto-stories'}
          color="#FFFFFF"
          size={22}
        />
      </PressableFeedback>

      {/* Controles de auto-scroll — esquina inferior derecha. En páginas no
          hay scroll que automatizar. */}
      {!paged && (
        <AutoScrollControls
          isPlaying={autoScroll.isPlaying}
          speedIndex={autoScroll.speedIndex}
          onToggle={autoScroll.toggle}
          onSelectSpeed={autoScroll.setSpeedIndex}
          isDark={isDark}
          bottom={controlsBottom}
        />
      )}
    </Animated.View>
  );
}

const webFrameStyle = {
  width: '100%',
  height: '100%',
  border: 'none',
  display: 'block',
} as React.CSSProperties;

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
    borderRadius: radii.xl,
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
  /* Anterior / siguiente — abajo a la izquierda */
  navCluster: {
    position: 'absolute',
    left: 16,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderRadius: radii.xl,
    overflow: 'hidden',
    zIndex: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  followPill: {
    gap: 8,
    paddingHorizontal: 14,
  },
  navButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navCount: {
    color: '#FFFFFF',
    ...typography.footnote,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  /* Modo atril — mismo aspecto que el botón de cerrar */
  pagedButton: {
    position: 'absolute',
    right: 24,
    width: 40,
    height: 40,
    borderRadius: radii.xl,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    zIndex: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
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
    borderRadius: radii.xl,
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
    borderRadius: radii.xl,
  },
  speedHeading: {
    color: 'rgba(255,255,255,0.92)',
    ...typography.micro,
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
    borderRadius: radii.pillFull,
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
    ...typography.footnote,
    fontWeight: '700',
  },
  segmentTextSelected: {
    color: '#1C1C1E',
  },
  /* Play / pause */
  playButton: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
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
    borderRadius: radii.full,
  },
  /* Pequeño badge con el nivel actual sobre el botón de play */
  levelBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: radii.sm,
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

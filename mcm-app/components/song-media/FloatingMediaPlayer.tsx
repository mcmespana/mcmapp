import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  LayoutAnimation,
  Linking,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { h } from '@/utils/haptics';
import { extractYouTubeId } from '@/utils/youtube';

export interface FloatingMediaSource {
  /** 'youtube' → URL de embed de YouTube · 'drive' → URL de preview de Drive. */
  kind: 'youtube' | 'drive';
  url: string;
  label: string;
}

interface FloatingMediaPlayerProps {
  source: FloatingMediaSource | null;
  onClose: () => void;
}

const YT_RED = '#FF3B30';
const PLAYER_WIDTH = 208;
// 16:9 → 208 * 9 / 16 ≈ 117 (igual que `.ytf-screen` del diseño).
const VIDEO_HEIGHT = Math.round((PLAYER_WIDTH * 9) / 16);
// Audio de Drive: barra de reproducción compacta, no necesita tanto alto
// como el vídeo pero sí casi todo el ancho disponible (el player de Drive
// se ve apretado en un ancho tan estrecho como el del PiP de vídeo).
const AUDIO_HEIGHT = 64;
const SIDE_MARGIN = 14;

/**
 * Referer que mandamos al cargar la página de embed de YouTube.
 *
 * CLAVE de por qué el player fallaba con "vídeo no disponible" (códigos
 * 152/153): YouTube exige que la petición del embed llegue con una cabecera
 * HTTP `Referer` real, como cuando una web (doceacordes) embebe el iframe.
 * Todo lo que se carga en el WebView vía `loadHTMLString` (HTML inyectado,
 * con o sin baseUrl, con o sin la IFrame API) sale SIN Referer y YouTube lo
 * rechaza según el vídeo. La solución es cargar la URL de embed real con
 * `source.headers.Referer` — el valor solo tiene que existir y ser una URL
 * plausible; no hace falta que el dominio sirva nada.
 */
const EMBED_REFERER = 'https://mcmespana.github.io/';

/** Añade los parámetros de reproducción inline/autoplay a la URL de embed. */
function withPlaybackParams(embedUrl: string): string {
  const sep = embedUrl.includes('?') ? '&' : '?';
  return `${embedUrl}${sep}playsinline=1&autoplay=1&rel=0`;
}

/** ¿La URL es una página de vídeo de YouTube (no de embed)? */
function isYouTubeWatchUrl(url: string): boolean {
  return /youtube\.com\/watch|youtu\.be\/|m\.youtube\.com/.test(url);
}

/**
 * Reproductor flotante multimedia (estilo PiP de iOS) que se superpone a la
 * letra sin taparla del todo y se puede arrastrar por la pantalla. Reproduce
 * vídeos de YouTube (embed con Referer real) y audios de Google Drive
 * (preview). En web cae a un `<iframe>` directo.
 *
 * El modo "grande" NO usa un Modal: el propio contenedor flotante se expande
 * a pantalla completa con una LayoutAnimation. Así el WebView es siempre la
 * MISMA instancia y el vídeo sigue reproduciéndose sin recargar al entrar o
 * salir de pantalla completa.
 */
export default function FloatingMediaPlayer({
  source,
  onClose,
}: FloatingMediaPlayerProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [fullscreen, setFullscreen] = useState(false);

  // Drag (arrastre) + animación de entrada.
  const pan = useRef(new Animated.ValueXY()).current;
  const enter = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 4 || Math.abs(dy) > 4,
      onPanResponderGrant: () => {
        pan.extractOffset();
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
      onPanResponderTerminate: () => {
        pan.flattenOffset();
      },
    }),
  ).current;

  // Al abrir una nueva fuente: reset de posición + animación de entrada.
  useEffect(() => {
    if (!source) return;
    pan.setValue({ x: 0, y: 0 });
    pan.setOffset({ x: 0, y: 0 });
    enter.setValue(0);
    Animated.spring(enter, {
      toValue: 1,
      useNativeDriver: false,
      tension: 90,
      friction: 11,
    }).start();
    // Solo cuando cambia la URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.url]);

  /**
   * Abre el vídeo preferentemente en la APP de YouTube (scheme nativo). Si
   * la app no está instalada, `openURL` del scheme falla y caemos a la URL
   * https vía Linking — que en iOS/Android también abre la app por universal
   * link si existe, y si no, el navegador.
   */
  const openInYouTube = useCallback(async (videoId: string | null) => {
    if (!videoId) return;
    const appUrl =
      Platform.OS === 'ios'
        ? `youtube://www.youtube.com/watch?v=${videoId}`
        : `vnd.youtube://watch?v=${videoId}`;
    try {
      await Linking.openURL(appUrl);
    } catch {
      try {
        await Linking.openURL(`https://www.youtube.com/watch?v=${videoId}`);
      } catch {
        /* sin YouTube ni navegador no hay nada que hacer */
      }
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    h.tap();
    // Anima el cambio de tamaño/posición del contenedor — el WebView es el
    // mismo, así que la reproducción continúa sin recargar.
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFullscreen((f) => !f);
  }, []);

  if (!source) return null;

  const isVideo = source.kind === 'youtube';
  const videoId = isVideo ? extractYouTubeId(source.url) : null;
  const pipHeight = isVideo ? VIDEO_HEIGHT : AUDIO_HEIGHT;
  // El pip de vídeo es estrecho a propósito (estilo PiP); el de audio
  // aprovecha casi todo el ancho de pantalla porque el reproductor de Drive
  // necesita más sitio para sus controles.
  const pipWidth = isVideo ? PLAYER_WIDTH : windowWidth - SIDE_MARGIN * 2;

  const handleClose = () => {
    h.tap();
    setFullscreen(false);
    onClose();
  };

  const playUri = isVideo ? withPlaybackParams(source.url) : source.url;

  // IMPORTANTE: una única superficie de vídeo en una posición fija del árbol
  // de componentes. Entre PiP y pantalla completa SOLO cambian estilos de los
  // contenedores — nunca desmontar/remontar el WebView/iframe, o el vídeo se
  // recarga desde el principio.
  const videoSurface =
    Platform.OS === 'web' ? (
      // @ts-ignore — iframe sólo existe en web
      <iframe
        src={playUri}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
          backgroundColor: '#000',
        }}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        title={source.label}
      />
    ) : (
      <WebView
        source={
          isVideo
            ? { uri: playUri, headers: { Referer: EMBED_REFERER } }
            : { uri: playUri }
        }
        style={{ flex: 1, backgroundColor: '#000' }}
        originWhitelist={['*']}
        allowsInlineMediaPlayback
        allowsPictureInPictureMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={(req) => {
          // Cualquier intento de salir del embed hacia la página de vídeo
          // (p.ej. tocar el logo o el "Ver en YouTube" del propio player) se
          // intercepta y se abre la app de YouTube en su lugar.
          if (isVideo && isYouTubeWatchUrl(req.url)) {
            void openInYouTube(videoId ?? extractYouTubeId(req.url));
            return false;
          }
          return true;
        }}
      />
    );

  const enterTranslateY = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });
  const enterScale = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });

  return (
    <Animated.View
      style={[
        styles.floatWrap,
        fullscreen
          ? styles.fsWrap
          : {
              width: pipWidth,
              right: SIDE_MARGIN,
              bottom: insets.bottom + 96,
              opacity: enter,
              transform: [
                { translateX: pan.x },
                { translateY: Animated.add(pan.y, enterTranslateY) },
                { scale: enterScale },
              ],
            },
      ]}
    >
      {/* Barra superior — arrastre (solo PiP) + título + acciones */}
      <View
        style={[styles.bar, fullscreen && { paddingTop: insets.top + 8 }]}
        {...(fullscreen ? {} : panResponder.panHandlers)}
      >
        <Text style={styles.barLabel} numberOfLines={1}>
          {source.label}
        </Text>
        {isVideo && (
          <TouchableOpacity
            onPress={() => {
              h.tap();
              void openInYouTube(videoId);
            }}
            style={styles.barBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Abrir en la app de YouTube"
          >
            <MaterialIcons name="smart-display" size={13} color={YT_RED} />
          </TouchableOpacity>
        )}
        {isVideo && (
          <TouchableOpacity
            onPress={toggleFullscreen}
            style={styles.barBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={
              fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'
            }
          >
            <MaterialIcons
              name={fullscreen ? 'fullscreen-exit' : 'fullscreen'}
              size={15}
              color="#fff"
            />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={handleClose}
          style={styles.barBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Cerrar reproductor"
        >
          <MaterialIcons name="close" size={15} color="#fff" />
        </TouchableOpacity>
      </View>
      {/* Pantalla del vídeo / reproductor de audio. En fullscreen el área
          crece y el vídeo se centra a 16:9; el WebView interior es siempre
          la misma instancia. */}
      <View
        style={
          fullscreen
            ? styles.fsVideoArea
            : { height: pipHeight, backgroundColor: '#000' }
        }
      >
        <View style={fullscreen ? styles.fsVideoInner : styles.videoFill}>
          {videoSurface}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  floatWrap: {
    position: 'absolute',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#111',
    zIndex: 70,
    ...Platform.select({
      web: { boxShadow: '0 10px 30px rgba(0,0,0,0.4)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 18,
        elevation: 12,
      },
    }),
  },
  fsWrap: {
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    borderRadius: 0,
    backgroundColor: '#000',
    zIndex: 90,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingLeft: 11,
    paddingRight: 8,
    backgroundColor: '#1c1c1e',
  },
  barLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  barBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  videoFill: {
    flex: 1,
  },
  fsVideoArea: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  fsVideoInner: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
});

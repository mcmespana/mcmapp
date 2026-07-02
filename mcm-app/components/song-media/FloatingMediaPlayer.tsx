import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
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
 * Página HTML mínima que instancia el reproductor con la **API oficial de
 * IFrame de YouTube** (`iframe_api`), en vez de un `<iframe src="…/embed/…">`
 * suelto. Un `<iframe>` a pelo cargado dentro de un WebView (vía
 * `loadHTMLString`/`loadDataWithBaseURL`) no manda un `Referer` real y
 * YouTube lo trata como un embed no fiable — algunos vídeos responden con
 * "vídeo no disponible" aunque el propio vídeo permita embeberse en
 * cualquier web (comprobable con el endpoint oembed). La API oficial hace el
 * handshake vía `postMessage` y con `playerVars.origin` fijo funciona de
 * forma consistente. Si aun así el vídeo da error (embed deshabilitado por
 * el autor, restricción regional, etc.), mostramos un fallback dentro de la
 * propia página con un botón que abre YouTube en el navegador.
 */
function embedShellHtml(videoId: string): string {
  const safeId = videoId.replace(/[^A-Za-z0-9_-]/g, '');
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
html,body{margin:0;padding:0;height:100%;background:#000;overflow:hidden}
#player{position:absolute;inset:0}
#player iframe{position:absolute!important;top:0;left:0;width:100%!important;height:100%!important;border:0}
#fallback{display:none;position:absolute;inset:0;flex-direction:column;align-items:center;justify-content:center;background:#141414;padding:16px;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,sans-serif;text-align:center}
#fallback.show{display:flex}
#fallback p{color:#fff;opacity:.75;font-size:12.5px;line-height:1.4;margin:0 0 12px}
#fallback button{background:${YT_RED};color:#fff;border:0;border-radius:16px;padding:9px 16px;font-size:12.5px;font-weight:600}
</style>
</head><body>
<div id="player"></div>
<div id="fallback">
  <p>Este vídeo no se puede reproducir aquí.</p>
  <button id="fallback-btn">Ver en YouTube</button>
</div>
<script>
function post(msg){ if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
document.getElementById('fallback-btn').addEventListener('click', function(){ post({ type: 'open-youtube' }); });
var tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
document.body.appendChild(tag);
function onYouTubeIframeAPIReady() {
  new YT.Player('player', {
    videoId: '${safeId}',
    playerVars: { playsinline: 1, autoplay: 1, rel: 0, origin: 'https://www.youtube.com' },
    events: {
      onError: function (e) {
        document.getElementById('fallback').classList.add('show');
        post({ type: 'yt-error', code: e && e.data });
      },
    },
  });
}
</script>
</body></html>`;
}

/** Añade los parámetros de reproducción inline/autoplay a la URL de embed (solo web). */
function withPlaybackParams(embedUrl: string): string {
  const sep = embedUrl.includes('?') ? '&' : '?';
  return `${embedUrl}${sep}playsinline=1&autoplay=1&rel=0`;
}

/**
 * Reproductor flotante multimedia (estilo PiP de iOS) que se superpone a la
 * letra sin taparla del todo y se puede arrastrar por la pantalla. Reproduce
 * vídeos de YouTube (embed) y audios de Google Drive (preview). En web cae a
 * un `<iframe>` directo, como hace cualquier página que embebe YouTube.
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

  const openInYouTube = useCallback((videoId: string | null) => {
    if (!videoId) return;
    void WebBrowser.openBrowserAsync(
      `https://www.youtube.com/watch?v=${videoId}`,
    );
  }, []);

  const handleWebViewMessage = useCallback(
    (event: WebViewMessageEvent, videoId: string | null) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg?.type === 'open-youtube') {
          openInYouTube(videoId);
        }
      } catch {
        /* mensaje no reconocido; se ignora */
      }
    },
    [openInYouTube],
  );

  if (!source) return null;

  const isVideo = source.kind === 'youtube';
  const videoId = isVideo ? extractYouTubeId(source.url) : null;
  const screenHeight = isVideo ? VIDEO_HEIGHT : AUDIO_HEIGHT;
  // El pip de vídeo es estrecho a propósito (estilo PiP); el de audio
  // aprovecha casi todo el ancho de pantalla porque el reproductor de Drive
  // necesita más sitio para sus controles.
  const floatWidth = isVideo ? PLAYER_WIDTH : windowWidth - SIDE_MARGIN * 2;

  const handleClose = () => {
    h.tap();
    setFullscreen(false);
    onClose();
  };

  const videoSurface = (height: number | '100%') => {
    if (Platform.OS === 'web') {
      const webSrc = isVideo ? withPlaybackParams(source.url) : source.url;
      return (
        // @ts-ignore — iframe sólo existe en web
        <iframe
          src={webSrc}
          style={{
            width: '100%',
            height,
            border: 'none',
            display: 'block',
            backgroundColor: '#000',
          }}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          title={source.label}
        />
      );
    }
    const nativeSource = isVideo
      ? {
          html: embedShellHtml(videoId ?? ''),
          baseUrl: 'https://www.youtube.com',
        }
      : { uri: source.url };
    return (
      <WebView
        source={nativeSource}
        style={{ width: '100%', height, backgroundColor: '#000' }}
        originWhitelist={['*']}
        allowsInlineMediaPlayback
        allowsPictureInPictureMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        onMessage={(e) => handleWebViewMessage(e, videoId)}
      />
    );
  };

  const enterTranslateY = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });
  const enterScale = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });

  return (
    <>
      <Animated.View
        style={[
          styles.floatWrap,
          {
            width: floatWidth,
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
        {/* Barra superior — arrastre + título + cerrar */}
        <View style={styles.bar} {...panResponder.panHandlers}>
          <Text style={styles.barLabel} numberOfLines={1}>
            {source.label}
          </Text>
          {isVideo && (
            <TouchableOpacity
              onPress={() => {
                h.tap();
                openInYouTube(videoId);
              }}
              style={styles.barBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Ver en YouTube"
            >
              <MaterialIcons name="open-in-new" size={13} color={YT_RED} />
            </TouchableOpacity>
          )}
          {isVideo && (
            <TouchableOpacity
              onPress={() => {
                h.tap();
                setFullscreen(true);
              }}
              style={styles.barBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Pantalla completa"
            >
              <MaterialIcons name="fullscreen" size={15} color="#fff" />
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
        {/* Pantalla del vídeo / reproductor de audio */}
        <View style={{ height: screenHeight, backgroundColor: '#000' }}>
          {!fullscreen && videoSurface(screenHeight)}
        </View>
      </Animated.View>

      {/* Pantalla completa (solo vídeo) */}
      <Modal
        visible={fullscreen}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setFullscreen(false)}
        supportedOrientations={[
          'portrait',
          'landscape-left',
          'landscape-right',
        ]}
      >
        <View style={styles.fsRoot}>
          <View style={[styles.fsBar, { paddingTop: insets.top + 6 }]}>
            <Text style={styles.fsLabel} numberOfLines={1}>
              {source.label}
            </Text>
            <TouchableOpacity
              onPress={() => {
                h.tap();
                setFullscreen(false);
              }}
              style={styles.fsClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Salir de pantalla completa"
            >
              <MaterialIcons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.fsVideo}>
            {fullscreen && (
              <View style={styles.fsVideoInner}>{videoSurface('100%')}</View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatWrap: {
    position: 'absolute',
    right: SIDE_MARGIN,
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
  fsRoot: {
    flex: 1,
    backgroundColor: '#000',
  },
  fsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 6,
    backgroundColor: '#000',
  },
  fsLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  fsClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsVideo: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  fsVideoInner: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
});

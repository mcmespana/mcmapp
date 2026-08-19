import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { h } from '@/utils/haptics';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
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
// Audio de Drive: no necesita tanto alto como el vídeo, pero sí casi todo el
// ancho disponible (el player de Drive se ve apretado en un ancho tan estrecho
// como el del PiP de vídeo) y bastante más de 64pt: el iframe de `/preview` de
// Drive pinta su propia cabecera encima de los controles, así que con 64 se veía
// una franja negra SIN el botón de play — o sea, indistinguible de "no pasa
// nada".
const AUDIO_HEIGHT = 116;
const SIDE_MARGIN = 14;
/** Alto de la barra de navegación del sistema, sin contar la barra de estado. */
const HEADER_BAR_HEIGHT = Platform.OS === 'ios' ? 44 : 56;

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
 * URL para abrir un audio FUERA de la app. El embed de Drive es `/preview`, que
 * fuera del iframe no siempre resuelve; `/view` es la página normal del fichero
 * y la captura la app de Drive por universal link.
 */
function toDriveViewUrl(previewUrl: string): string {
  return previewUrl.replace(/\/preview(\?.*)?$/, '/view');
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
  const { width: windowWidth } = useWindowDimensions();
  // Se apoya sobre la barra de pestañas flotante, que ya incluye el inset.
  const tabBarClearance = useTabBarClearance();
  const insets = useSafeAreaInsets();
  const [fullscreen, setFullscreen] = useState(false);
  // Estado de carga del embed. Sin esto, un embed que tarda o que falla se ve
  // como un rectángulo negro y no hay forma de distinguir "cargando" de "roto"
  // ni salida posible: ahora se avisa y se ofrece abrirlo fuera.
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );

  // Drag (arrastre) + animación de entrada.
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const enter = useSharedValue(0);
  // Posición al empezar el gesto: hace que cada arrastre CONTINÚE desde donde
  // se dejó el anterior. Es lo que hacían `extractOffset`/`flattenOffset`.
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // El arrastre va por gesture-handler, así que corre entero en el hilo de UI:
  // el reproductor sigue al dedo aunque JS esté ocupado (que es lo normal, con
  // un WebView reproduciendo al lado).
  const drag = Gesture.Pan()
    .minDistance(4)
    .onStart(() => {
      startX.set(panX.get());
      startY.set(panY.get());
    })
    .onUpdate((e) => {
      panX.set(startX.get() + e.translationX);
      panY.set(startY.get() + e.translationY);
    });

  // Fuente nueva → vuelta a "cargando". Se ajusta DURANTE el render (el patrón
  // que documenta React para "cambiar estado cuando cambia una prop") en vez de
  // en el efecto de abajo: así no hay un render intermedio mostrando el estado
  // de la fuente anterior.
  const [lastUrl, setLastUrl] = useState(source?.url);
  if (source?.url !== lastUrl) {
    setLastUrl(source?.url);
    setLoadState('loading');
  }

  // Al abrir una nueva fuente: reset de posición + animación de entrada.
  useEffect(() => {
    if (!source) return;
    panX.set(0);
    panY.set(0);
    enter.set(0);
    // `tension: 90, friction: 11` de RN Animated → mismo muelle aquí.
    enter.set(withSpring(1, { stiffness: 90, damping: 11, mass: 1 }));
    // Solo cuando cambia la URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.url]);

  // OJO: la opacidad NO va aquí. El reproductor nace justo cuando se está
  // desmontando el `Modal` de la hoja de multimedia, y en ese momento el estilo
  // animado de Reanimated puede no llegar a aplicarse nunca: con `opacity:
  // enter.get()` (que empieza en 0) el vídeo se quedaba sonando con el
  // reproductor INVISIBLE, sin forma de pararlo ni de verlo. La entrada se
  // queda en el desplazamiento y la escala, que si no se animan dejan el
  // reproductor visible igualmente.
  const pipStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: panX.get() },
      // La entrada sube 14pt y el arrastre se suma encima.
      { translateY: panY.get() + interpolate(enter.get(), [0, 1], [14, 0]) },
      { scale: interpolate(enter.get(), [0, 1], [0.96, 1]) },
    ],
  }));

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

  /** Abre la fuente fuera de la app: YouTube o Drive, según el tipo. */
  const openOutside = useCallback(() => {
    if (!source) return;
    h.tap();
    if (source.kind === 'youtube') {
      void openInYouTube(extractYouTubeId(source.url));
      return;
    }
    Linking.openURL(toDriveViewUrl(source.url)).catch(() => {
      /* sin Drive ni navegador no hay nada que hacer */
    });
  }, [source, openInYouTube]);

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
        onLoad={() => setLoadState('ready')}
        onError={() => setLoadState('error')}
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
        // Una vez que el embed ha cargado ya no se degrada a error: algunos
        // subrecursos del player de YouTube/Drive devuelven 4xx sin que la
        // reproducción se vea afectada.
        onLoadEnd={() => setLoadState((s) => (s === 'error' ? s : 'ready'))}
        onError={() => setLoadState((s) => (s === 'ready' ? s : 'error'))}
        onHttpError={() => setLoadState((s) => (s === 'ready' ? s : 'error'))}
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

  const bar = (
    <View
      style={[
        styles.bar,
        // En pantalla completa el reproductor tapa toda la pantalla, pero el
        // header del stack es NATIVO y se pinta ENCIMA: sin reservar su alto,
        // los botones de la barra (YouTube, salir de pantalla completa,
        // cerrar) caían debajo del back y no se podían tocar. No se usa
        // `useHeaderHeight()` a propósito: revienta si el reproductor se monta
        // fuera de una pantalla con header (los tests, sin ir más lejos).
        fullscreen && { paddingTop: insets.top + HEADER_BAR_HEIGHT + 8 },
      ]}
    >
      <Text style={styles.barLabel} numberOfLines={1}>
        {source.label}
      </Text>
      {/* Salida a la app externa: YouTube para vídeo, Drive para audio. El
          audio no la tenía, así que si el embed de Drive no arrancaba no había
          ninguna forma de llegar a la pista. */}
      <TouchableOpacity
        onPress={openOutside}
        style={styles.barBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={
          isVideo ? 'Abrir en la app de YouTube' : 'Abrir en Google Drive'
        }
      >
        <MaterialIcons
          name={isVideo ? 'smart-display' : 'open-in-new'}
          size={isVideo ? 13 : 14}
          color={isVideo ? YT_RED : '#fff'}
        />
      </TouchableOpacity>
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
  );

  return (
    <Animated.View
      style={[
        styles.floatWrap,
        fullscreen
          ? styles.fsWrap
          : [
              {
                width: pipWidth,
                right: SIDE_MARGIN,
                // La barra de pestañas FLOTA sobre el contenido, así que el
                // reproductor tiene que apoyarse encima de ella.
                bottom: tabBarClearance + 18,
              },
              pipStyle,
            ],
      ]}
    >
      {/* Barra superior — arrastre (solo PiP) + título + acciones */}
      {fullscreen ? (
        bar
      ) : (
        <GestureDetector gesture={drag}>{bar}</GestureDetector>
      )}
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
          {/* Cargando / no se pudo cargar. Va ENCIMA del embed (no en su lugar)
              para no desmontarlo: si termina de cargar, el overlay se va y la
              reproducción sigue. */}
          {loadState !== 'ready' && (
            <View style={styles.stateOverlay} pointerEvents="box-none">
              {loadState === 'loading' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <TouchableOpacity
                  onPress={openOutside}
                  style={styles.errorBtn}
                  accessibilityLabel={
                    isVideo
                      ? 'No se pudo cargar aquí: abrir en YouTube'
                      : 'No se pudo cargar aquí: abrir en Drive'
                  }
                >
                  <MaterialIcons name="open-in-new" size={16} color="#fff" />
                  <Text style={styles.errorText} numberOfLines={2}>
                    No se pudo cargar aquí.{'\n'}Toca para abrirlo fuera.
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
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
  stateOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  errorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    color: '#fff',
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

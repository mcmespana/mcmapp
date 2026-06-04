import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { h } from '@/utils/haptics';

export interface FloatingVideoSource {
  embedUrl: string;
  label: string;
}

interface FloatingYouTubePlayerProps {
  source: FloatingVideoSource | null;
  onClose: () => void;
}

const PLAYER_WIDTH = 208;
// 16:9 → 208 * 9 / 16 ≈ 117 (igual que `.ytf-screen` del diseño).
const SCREEN_HEIGHT = Math.round((PLAYER_WIDTH * 9) / 16);

/** Añade los parámetros de reproducción inline/autoplay a la URL de embed. */
function withPlaybackParams(embedUrl: string): string {
  const sep = embedUrl.includes('?') ? '&' : '?';
  return `${embedUrl}${sep}playsinline=1&autoplay=1&rel=0`;
}

/**
 * Reproductor flotante de YouTube (estilo PiP de iOS) que se superpone a la
 * letra sin taparla del todo y se puede arrastrar por la pantalla. En web cae
 * a un `<iframe>` (la PiP nativa no está disponible).
 */
export default function FloatingYouTubePlayer({
  source,
  onClose,
}: FloatingYouTubePlayerProps) {
  const insets = useSafeAreaInsets();
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
    // Solo cuando cambia la URL del vídeo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.embedUrl]);

  if (!source) return null;

  const handleClose = () => {
    h.tap();
    setFullscreen(false);
    onClose();
  };

  const playUri = withPlaybackParams(source.embedUrl);

  const videoSurface = (height: number | '100%') =>
    Platform.OS === 'web' ? (
      // @ts-ignore — iframe sólo existe en web
      <iframe
        src={playUri}
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
    ) : (
      <WebView
        source={{ uri: playUri }}
        style={{ width: '100%', height, backgroundColor: '#000' }}
        originWhitelist={['*']}
        allowsInlineMediaPlayback
        allowsPictureInPictureMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
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
    <>
      <Animated.View
        style={[
          styles.floatWrap,
          {
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
          <TouchableOpacity
            onPress={handleClose}
            style={styles.barBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Cerrar reproductor"
          >
            <MaterialIcons name="close" size={15} color="#fff" />
          </TouchableOpacity>
        </View>
        {/* Pantalla del vídeo */}
        <View style={{ height: SCREEN_HEIGHT, backgroundColor: '#000' }}>
          {!fullscreen && videoSurface(SCREEN_HEIGHT)}
        </View>
      </Animated.View>

      {/* Pantalla completa */}
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
    right: 14,
    width: PLAYER_WIDTH,
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

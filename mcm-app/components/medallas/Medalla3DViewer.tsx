import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import {
  buildMedalViewerHtml,
  type MedalViewerMessage,
} from '@/components/medallas/medalViewerHtml';

type Props = {
  /** URL del `.glb` (ver `medalViewerHtml.ts`). */
  src: string;
  spinIn?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Una medalla en 3D que se gira con el dedo. Fondo transparente: quien lo
 * monta decide sobre qué se pinta.
 *
 * Nativo: WebView con `<model-viewer>`. Web: el mismo HTML en un iframe
 * (`react-native-webview` no existe en web). Necesita red: el visor y el
 * modelo vienen de jsDelivr.
 *
 * El estado de carga no se reinicia si cambia `src`: para otra medalla, se
 * monta otro visor (`key`).
 */
export function Medalla3DViewer({ src, spinIn = true, style }: Props) {
  const html = useMemo(
    () => buildMedalViewerHtml({ src, spinIn }),
    [src, spinIn],
  );
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const onMessage = useCallback((msg: unknown) => {
    const m = msg as MedalViewerMessage;
    if (m === 'loaded') setState('ready');
    else if (m === 'error') setState('error');
  }, []);

  // En web, la página del iframe avisa con parent.postMessage.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: MessageEvent) => onMessage(e.data);
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onMessage]);

  return (
    <View style={[styles.root, style]}>
      {Platform.OS === 'web' ? (
        // @ts-ignore — iframe sólo existe en web
        <iframe
          srcDoc={html}
          title="Medalla en 3D"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
            background: 'transparent',
          }}
        />
      ) : (
        <WebView
          source={{ html, baseUrl: 'https://cdn.jsdelivr.net/' }}
          originWhitelist={['*']}
          onMessage={(e: WebViewMessageEvent) => onMessage(e.nativeEvent.data)}
          onError={() => setState('error')}
          style={styles.web}
          containerStyle={styles.web}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          setSupportMultipleWindows={false}
          // Sin esto Android pinta un fondo blanco detrás del canvas.
          androidLayerType="hardware"
        />
      )}

      {state === 'loading' ? (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : null}
      {state === 'error' ? (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.error}>
            No se ha podido cargar la medalla. ¿Hay conexión?
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
  },
  web: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  error: {
    ...typography.subhead,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
});

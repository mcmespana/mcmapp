import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
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

import {
  buildPanueloCommandScript,
  buildPanueloViewerHtml,
} from '@/components/panuelo/panueloViewerHtml';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import type {
  PanueloCommand,
  PanueloEvent,
  PanueloViewerState,
} from '@/types/panuelo';

export interface Panuelo3DHandle {
  /** Manda una orden al visor (enfocar una pieza, presentarla…). */
  send: (command: PanueloCommand) => void;
}

type Props = {
  /** El color y las piezas cosidas. El visor anima los cambios. */
  state: PanueloViewerState;
  mode: 'view' | 'edit';
  onEvent?: (event: PanueloEvent) => void;
  /** Color del indicador de carga y del texto de error. */
  tintColor: string;
  /** Mover el pañuelo al inclinar el móvil (solo nativo). */
  tilt?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * El pañuelo en 3D. Fondo transparente: quien lo monta decide sobre qué se
 * pinta.
 *
 * Nativo: un WebView con el visor (`panuelo-3d/`) dentro. Web: la misma
 * página en un iframe (`react-native-webview` no existe en web). No necesita
 * red: three.js va empaquetado con la app.
 *
 * La página se construye UNA vez con el estado inicial; después todo cambia
 * por órdenes (`PanueloCommand`), sin recargar. Recargar el WebView en cada
 * cambio tiraría el contexto WebGL y la posición en la que la persona había
 * dejado el pañuelo.
 */
export const Panuelo3D = forwardRef<Panuelo3DHandle, Props>(function Panuelo3D(
  { state, mode, onEvent, tintColor, tilt = true, style },
  ref,
) {
  const [html] = useState(() => buildPanueloViewerHtml({ state, mode }));
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const webRef = useRef<WebView>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const readyRef = useRef(false);
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const send = useCallback((command: PanueloCommand) => {
    if (Platform.OS === 'web') {
      frameRef.current?.contentWindow?.postMessage(
        { panueloCommand: command },
        '*',
      );
    } else {
      webRef.current?.injectJavaScript(buildPanueloCommandScript(command));
    }
  }, []);

  useImperativeHandle(ref, () => ({ send }), [send]);

  const handleMessage = useCallback((raw: unknown) => {
    if (typeof raw !== 'string') return;
    let event: PanueloEvent;
    try {
      event = JSON.parse(raw) as PanueloEvent;
    } catch {
      return;
    }
    if (event.type === 'ready') {
      readyRef.current = true;
      setStatus('ready');
    } else if (event.type === 'error' && !readyRef.current) {
      // Un error ANTES de arrancar (sin WebGL) deja la pantalla sin pañuelo;
      // uno posterior no merece tapar el que ya se está viendo.
      setStatus('error');
    }
    onEventRef.current?.(event);
  }, []);

  // En web la página del iframe avisa con `parent.postMessage`.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow) return;
      handleMessage((e.data as { panuelo?: unknown } | null)?.panuelo);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [handleMessage]);

  // El estado y el modo viajan como órdenes en cuanto el visor está listo.
  // La primera vez no hace falta: la página ya nació con ellos.
  const sentState = useRef(state);
  const sentMode = useRef(mode);
  useEffect(() => {
    if (status !== 'ready') return;
    if (sentState.current !== state) {
      sentState.current = state;
      send({ type: 'state', state });
    }
    if (sentMode.current !== mode) {
      sentMode.current = mode;
      send({ type: 'mode', mode });
    }
  }, [status, state, mode, send]);

  useTilt(tilt && status === 'ready', send);

  return (
    <View style={[styles.root, style]}>
      {Platform.OS === 'web' ? (
        // @ts-ignore — iframe solo existe en web
        <iframe
          ref={frameRef}
          srcDoc={html}
          title="Pañuelo en 3D"
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
          ref={webRef}
          // La base es la CDN de las imágenes de las medallas: así el WebView
          // las pide desde un origen `https` y no desde `about:blank`.
          source={{ html, baseUrl: 'https://cdn.jsdelivr.net/' }}
          originWhitelist={['*']}
          onMessage={(e: WebViewMessageEvent) =>
            handleMessage(e.nativeEvent.data)
          }
          onError={() => setStatus('error')}
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
          accessibilityLabel="Pañuelo en tres dimensiones. Arrastra para girarlo."
        />
      )}

      {status === 'loading' ? (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator size="large" color={tintColor} />
        </View>
      ) : null}
      {status === 'error' ? (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={[styles.error, { color: tintColor }]}>
            Este dispositivo no puede pintar el pañuelo en 3D. Tu colección
            sigue aquí abajo.
          </Text>
        </View>
      ) : null}
    </View>
  );
});

/**
 * Inclinar el móvil mueve un poco el pañuelo, y con eso el metal de los pines
 * brilla al pasar la luz. La posición en la que se coge el móvil es el «cero»:
 * lo que cuenta es lo que se inclina desde ahí.
 */
function useTilt(enabled: boolean, send: (command: PanueloCommand) => void) {
  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    let subscription: { remove: () => void } | null = null;
    try {
      const { Accelerometer } =
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('expo-sensors') as typeof import('expo-sensors');
      Accelerometer.setUpdateInterval(60);
      let zero: { x: number; y: number } | null = null;
      let smooth = { x: 0, y: 0 };
      let last = { x: 0, y: 0 };
      subscription = Accelerometer.addListener(
        ({ x, y }: { x: number; y: number }) => {
          if (!zero) zero = { x, y };
          // Filtro paso bajo: la mano tiembla, el pañuelo no.
          smooth = {
            x: smooth.x + (x - zero.x - smooth.x) * 0.18,
            y: smooth.y + (y - zero.y - smooth.y) * 0.18,
          };
          const next = {
            x: Math.max(-1, Math.min(1, smooth.x * 2.2)),
            y: Math.max(-1, Math.min(1, -smooth.y * 2.2)),
          };
          if (
            Math.abs(next.x - last.x) < 0.012 &&
            Math.abs(next.y - last.y) < 0.012
          ) {
            return;
          }
          last = next;
          send({ type: 'tilt', x: next.x, y: next.y });
        },
      );
    } catch {
      // Sin sensores, el pañuelo se queda quieto: no pasa nada.
    }
    return () => subscription?.remove();
  }, [enabled, send]);
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
    textAlign: 'center',
  },
});

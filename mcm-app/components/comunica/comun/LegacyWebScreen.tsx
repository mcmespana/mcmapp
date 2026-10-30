// Una página del plugin dentro de la app (plan 10 §2): cabecera nativa con su
// título y el botón atrás del sistema, el cargador de Comunica mientras llega,
// y los enlaces a páginas que ya son nativas se abren en nativo.
//
// El hueco de arriba (la cabecera transparente de iOS) y el de abajo (la barra
// de pestañas flotante) se reservan como en `app/screens/ComunicaScreen.tsx`:
//   · iOS → `contentInset` del WebView, más las variables CSS de
//     `safeAreaBridgeJS` para la web que las use.
//   · Android → la cabecera ocupa su sitio; el hueco de abajo lo reserva la
//     PÁGINA (`safeAreaBridgeJS` con padding), porque su WebView no tiene
//     `contentInset`.
// Si la página no carga, el cargador pasa a error con «Reintentar».
//
// Con el servidor falso, la web de verdad pediría entrar (el pase es
// inventado): se enseña una página de muestra con el destino (plan 10 §2).

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import ComunicaLoader from '@/components/ui/ComunicaLoader';
import EmptyState from '@/components/ui/EmptyState';
import { useColorScheme } from '@/hooks/useColorScheme';
import { safeAreaBridgeJS } from '@/hooks/useComunicaWebView';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import spacing from '@/constants/spacing';
import { getFakeServer } from '@/services/comunica';
import {
  COMUNICA_HOST,
  decideLegacyNavigation,
} from '@/services/comunica/links';
import AreaScreen from './AreaScreen';
import { useComunicaTheme } from './useComunicaTheme';

type Status = 'loading' | 'ready' | 'error';

/** ¿Es una página del área privada del plugin (`/ap/…`)? Su `internalpage`. */
export function pluginPageOf(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== COMUNICA_HOST || !u.pathname.startsWith('/ap')) {
      return null;
    }
    return u.searchParams.get('internalpage') ?? 'portada';
  } catch {
    return null;
  }
}

export default function LegacyWebScreen({
  url,
  title,
}: {
  url: string;
  title: string;
}) {
  const sample = getFakeServer() ? pluginPageOf(url) : null;
  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title, headerLargeTitle: false }}
      />
      {sample ? <FakeSample page={sample} /> : <LegacyWeb url={url} />}
    </>
  );
}

function LegacyWeb({ url }: { url: string }) {
  const t = useComunicaTheme();
  const scheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const webRef = useRef<WebView>(null);
  const { width } = useWindowDimensions();
  const headerHeight = useHeaderHeight();
  const [status, setStatus] = useState<Status>('loading');
  const [progress, setProgress] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const themed = `${url}${url.includes('?') ? '&' : '?'}theme=${scheme}`;

  // Arriba: en iOS la cabecera es transparente y la web pasa por debajo.
  const top = Platform.OS === 'ios' ? headerHeight : 0;
  // Abajo: la barra de pestañas flota encima; más un respiro.
  const bottom = useTabBarClearance(spacing.md);
  const safeAreaJS = useMemo(
    () =>
      safeAreaBridgeJS({
        top,
        bottom,
        widthDp: width,
        applyPadding: Platform.OS === 'android',
      }),
    [top, bottom, width],
  );

  const onShouldStart = useCallback(
    (req: WebViewNavigation) => {
      const d = decideLegacyNavigation(req.url);
      if (d.allow) return true;
      if (d.native) router.push(d.native as never);
      else if (d.external) void Linking.openURL(d.external);
      return false;
    },
    [router],
  );

  const retry = useCallback(() => {
    setStatus('loading');
    setProgress(0);
    setAttempt((n) => n + 1);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: t.background }]}>
      {Platform.OS === 'web' ? (
        React.createElement('iframe', {
          key: attempt,
          src: themed,
          title: 'Comunica',
          style: {
            border: 0,
            width: '100%',
            height: '100%',
            paddingBottom: bottom,
            boxSizing: 'border-box',
          },
          onLoad: () => setStatus('ready'),
          onError: () => setStatus('error'),
        })
      ) : (
        <WebView
          key={attempt}
          ref={webRef}
          source={{ uri: themed }}
          sharedCookiesEnabled
          onShouldStartLoadWithRequest={onShouldStart}
          injectedJavaScript={safeAreaJS}
          onLoadEnd={() =>
            setStatus((s) => (s === 'error' ? 'error' : 'ready'))
          }
          onLoadProgress={(e) => setProgress(e.nativeEvent.progress)}
          onError={() => setStatus('error')}
          onHttpError={() => setStatus('error')}
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          contentInset={{ top, left: 0, right: 0, bottom }}
          style={[styles.root, { backgroundColor: t.background }]}
        />
      )}
      {status !== 'ready' ? (
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents={status === 'error' ? 'auto' : 'none'}
        >
          <ComunicaLoader
            scheme={scheme}
            progress={progress}
            error={status === 'error'}
            onRetry={retry}
            insetTop={top}
            insetBottom={bottom}
          />
        </View>
      ) : null}
    </View>
  );
}

function FakeSample({ page }: { page: string }) {
  const t = useComunicaTheme();
  return (
    <AreaScreen sunken={false}>
      <EmptyState
        icon="language"
        title="Aquí se abriría la web del área privada"
        subtitle={`Página «${page}». Con el servidor de prueba no se abre la web de verdad: pediría entrar, porque el pase es inventado.`}
        titleColor={t.text}
        subtitleColor={t.textSecondary}
      />
    </AreaScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

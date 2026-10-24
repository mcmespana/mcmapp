// Una página del plugin dentro de la app (plan 10 §2): cabecera nativa con su
// título y el botón atrás del sistema, el cargador de Comunica mientras llega,
// y los enlaces a páginas que ya son nativas se abren en nativo.

import React, { useCallback, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import ComunicaLoader from '@/components/ui/ComunicaLoader';
import { useColorScheme } from '@/hooks/useColorScheme';
import { decideLegacyNavigation } from '@/services/comunica/links';
import { useComunicaTheme } from './useComunicaTheme';

export default function LegacyWebScreen({
  url,
  title,
}: {
  url: string;
  title: string;
}) {
  const t = useComunicaTheme();
  const scheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const themed = `${url}${url.includes('?') ? '&' : '?'}theme=${scheme}`;

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

  return (
    <View style={[styles.root, { backgroundColor: t.background }]}>
      <Stack.Screen
        options={{ headerShown: true, title, headerLargeTitle: false }}
      />
      {Platform.OS === 'web' ? (
        React.createElement('iframe', {
          src: themed,
          title,
          style: { border: 0, width: '100%', height: '100%' },
          onLoad: () => setLoading(false),
        })
      ) : (
        <WebView
          source={{ uri: themed }}
          sharedCookiesEnabled
          onShouldStartLoadWithRequest={onShouldStart}
          onLoadEnd={() => setLoading(false)}
          onLoadProgress={(e) => setProgress(e.nativeEvent.progress)}
          style={styles.root}
        />
      )}
      {loading ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <ComunicaLoader scheme={scheme} progress={progress} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

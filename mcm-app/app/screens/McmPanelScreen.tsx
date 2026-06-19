// app/screens/McmPanelScreen.tsx
// WebView para mcmpanel.vercel.app — solo accesible para administradores.
// Sin header, pantalla completa, cookies persistentes.

import React, { useState, useCallback, useMemo } from 'react';
import {
  Platform,
  View,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useToast } from '@/contexts/AppToastContext';
import { Colors as ThemeColors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

// CSS module reutilizado del iframe (solo aplica en web)
/* eslint-disable @typescript-eslint/no-require-imports */
const iframeStyles =
  Platform.OS === 'web' ? require('../../styles/comunica.module.css') : null;
/* eslint-enable @typescript-eslint/no-require-imports */

const MCM_PANEL_URL = 'https://mcmpanel.vercel.app';

// Violeta oscuro — evoca "panel de administración", distinto del azul MCM.
const NOTCH_COLOR = '#4C1D95';

export default function McmPanelScreen() {
  const scheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const tintColor = ThemeColors[scheme].tint;
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // El panel se monta como Stack.Screen DENTRO del tab "Más", así que la tab
  // bar sigue visible. En iOS es una NativeTabs (UITabBar TRANSLÚCIDO) y el
  // WebView se dibujaba por debajo, por eso (a) no se podía hacer scroll hasta
  // el final —la última franja quedaba bajo la barra— y (b) el blanco del panel
  // traspasaba el cristal creando un "aura". Reservamos la altura real de la
  // barra (≈49 + safe-area) para que el WebView termine justo encima, y
  // pintamos ese hueco con el fondo del sistema (no blanco) para que el cristal
  // no brille. En Android la tab bar es opaca y el contenido ya queda por
  // encima → no hace falta reservar nada (un spacer dejaría un hueco vacío).
  const tabBarSpace = Platform.OS === 'ios' ? insets.bottom + 49 : 0;
  const screenBg = scheme === 'dark' ? '#1C1C1E' : '#F2F2F7';

  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        loadingContainer: {
          ...StyleSheet.absoluteFillObject,
          justifyContent: 'center' as const,
          alignItems: 'center' as const,
          backgroundColor:
            scheme === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)',
        },
      }),
    [scheme],
  );

  const onLoadEnd = useCallback(() => setIsLoading(false), []);
  const onError = useCallback(() => {
    toast.show({
      variant: 'danger',
      label: 'Error al cargar el panel. Verifica tu conexión a internet.',
      actionLabel: 'Cerrar',
      onActionPress: ({ hide }) => hide(),
    });
    setIsLoading(false);
  }, [toast]);

  // ── Web: iframe ──────────────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <iframe
          src={MCM_PANEL_URL}
          title="MCM Panel"
          className={iframeStyles?.iframe}
          style={{ flex: 1, width: '100%', height: '100%', border: 'none' }}
          onLoad={onLoadEnd}
        />
        {isLoading && (
          <View style={dynamicStyles.loadingContainer}>
            <ActivityIndicator size="large" color={tintColor} />
          </View>
        )}
      </View>
    );
  }

  // ── iOS / Android: WebView nativo con barra de color en el notch ────────
  return (
    <View style={[styles.container, { backgroundColor: screenBg }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={NOTCH_COLOR}
        translucent
      />
      {insets.top > 0 && (
        <View
          style={[
            styles.notchBar,
            { backgroundColor: NOTCH_COLOR, height: insets.top },
          ]}
        />
      )}
      <WebView
        source={{ uri: MCM_PANEL_URL }}
        style={[styles.webview, { backgroundColor: screenBg }]}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        renderLoading={() => (
          <View style={dynamicStyles.loadingContainer}>
            <ActivityIndicator size="large" color={tintColor} />
          </View>
        )}
        onLoadEnd={onLoadEnd}
        onError={onError}
        onHttpError={onError}
      />
      {/* Hueco reservado para la tab bar: el WebView termina aquí, así se puede
          hacer scroll hasta el fondo y el blanco del panel ya no traspasa el
          cristal de la barra. */}
      <View style={{ height: tabBarSpace, backgroundColor: screenBg }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  notchBar: {
    width: '100%',
  },
  webview: {
    flex: 1,
  } as any,
});

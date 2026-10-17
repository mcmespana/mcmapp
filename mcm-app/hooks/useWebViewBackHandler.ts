import { useCallback, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router/react-navigation';
import type { WebView, WebViewNavigation } from 'react-native-webview';

/**
 * Atrás de Android dentro de una web embebida: primero navega por el historial
 * de la web y solo sale de la pantalla cuando ya no hay a dónde volver. Es el
 * patrón de `useComunicaWebView`, para los WebViews que no necesitan más
 * (MCM Panel, Gestión de Comunica).
 *
 * Devuelve el `ref` y el `onNavigationStateChange` que hay que pasarle al
 * `<WebView>`. `canGoBack` va en un ref y no en estado: solo lo lee el botón
 * atrás, así que no hace falta volver a pintar en cada navegación.
 */
export function useWebViewBackHandler() {
  const webViewRef = useRef<WebView>(null);
  const canGoBackRef = useRef(false);

  const onNavigationStateChange = useCallback((s: WebViewNavigation) => {
    canGoBackRef.current = s.canGoBack;
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!canGoBackRef.current) return false;
        webViewRef.current?.goBack();
        return true;
      });
      return () => sub.remove();
    }, []),
  );

  return { webViewRef, onNavigationStateChange };
}

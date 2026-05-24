import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { Spinner } from 'heroui-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import type { SongStyleState } from '@/hooks/useSongProcessor';

interface SongDisplayProps {
  songHtml: string;
  isLoading: boolean;
  /**
   * Live style snapshot. Changes are pushed into the WebView via
   * `postMessage` / `injectJavaScript`, avoiding the full HTML reload that
   * caused the previous 200–500ms flicker on every settings tweak.
   */
  styleState?: SongStyleState;
}

const SongDisplay: React.FC<SongDisplayProps> = ({
  songHtml,
  isLoading,
  styleState,
}) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const layout = useResponsiveLayout();
  const webViewRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Tracks whether the document is loaded so we can flush queued style updates.
  const readyRef = useRef(false);
  // Latest style we tried to apply (to re-flush on (re)load).
  const pendingStyleRef = useRef<SongStyleState | undefined>(styleState);
  pendingStyleRef.current = styleState;
  // En iPad / web amplio la card del WebView está dentro de un wrapper
  // centrado con margen alrededor. Para que no se vea cortada por abajo
  // (en iOS sólo aplicamos esquinas top-only), añadimos las esquinas
  // inferiores también.
  const wideRadiusStyle = layout.isWide
    ? {
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        marginBottom: 8,
      }
    : null;

  // Push style updates into the WebView/iframe without rebuilding the HTML.
  useEffect(() => {
    if (!styleState) return;
    const payload = JSON.stringify(styleState);

    if (Platform.OS === 'web') {
      const iframe = iframeRef.current;
      if (!iframe) return;
      const send = () => {
        try {
          iframe.contentWindow?.postMessage(payload, '*');
        } catch {
          /* noop */
        }
      };
      if (readyRef.current) send();
      else iframe.addEventListener('load', send, { once: true });
      return;
    }

    if (!webViewRef.current) return;
    // injectJavaScript runs immediately even if the page is not fully ready;
    // we still guard against the bridge not being installed yet.
    const js = `(function(){try{var s=${payload};if(window.__SONG_BRIDGE__){window.__SONG_BRIDGE__.apply(s);}}catch(_){};true;})();`;
    webViewRef.current.injectJavaScript(js);
  }, [styleState]);

  // When the HTML reloads (structural change), the bridge is fresh — re-mark
  // not-ready so the next style update re-flushes on load.
  useEffect(() => {
    readyRef.current = false;
  }, [songHtml]);

  if (isLoading) {
    return (
      <View
        style={[
          styles.cardContainer,
          isDark && styles.cardContainerDark,
          styles.loadingContainer,
          wideRadiusStyle,
        ]}
      >
        <Spinner size="lg" color="#f4c11e" />
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          styles.cardContainer,
          isDark && styles.cardContainerDark,
          wideRadiusStyle,
        ]}
      >
        <iframe
          ref={iframeRef}
          srcDoc={songHtml}
          onLoad={() => {
            readyRef.current = true;
            const s = pendingStyleRef.current;
            if (s) {
              try {
                iframeRef.current?.contentWindow?.postMessage(
                  JSON.stringify(s),
                  '*',
                );
              } catch {
                /* noop */
              }
            }
          }}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
            backgroundColor: isDark ? '#2C2C2E' : '#fff',
          }}
          title="Song content"
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.cardContainer,
        isDark && styles.cardContainerDark,
        wideRadiusStyle,
      ]}
    >
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: songHtml }}
        style={styles.webView}
        showsVerticalScrollIndicator={false}
        onLoadEnd={() => {
          readyRef.current = true;
          const s = pendingStyleRef.current;
          if (s && webViewRef.current) {
            const js = `(function(){try{var s=${JSON.stringify(s)};if(window.__SONG_BRIDGE__){window.__SONG_BRIDGE__.apply(s);}}catch(_){};true;})();`;
            webViewRef.current.injectJavaScript(js);
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    flex: 1,
    marginHorizontal: 12,
    marginTop: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
    ...Platform.select({
      ios: {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      web: {
        borderRadius: 16,
        marginBottom: 8,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      },
      default: {
        borderRadius: 16,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  cardContainerDark: {
    backgroundColor: '#2C2C2E',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
      },
      default: {
        shadowOpacity: 0.15,
      },
    }),
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default SongDisplay;

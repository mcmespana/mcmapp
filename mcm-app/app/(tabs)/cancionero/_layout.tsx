import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Stack, router, useGlobalSearchParams, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabReselect } from '@/components/tabs/tabBarController';
import { useColorScheme } from '@/hooks/useColorScheme';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { TabHeaderColors, themeColors } from '@/constants/colors';
import { cantoralHeaderTint } from '@/utils/cantoralHeader';
import TabTintBar from '@/components/ui/TabTintBar';
import { useChoirSession } from '@/contexts/ChoirSessionContext';
import { extractSongMedia } from '@/types/songMedia';
import {
  CANTORAL_BASE,
  CANTORAL_SLUGS,
  cantoralHref,
  lastSegment,
} from '@/utils/eventRoutes';
import { songRouteParams } from '@/utils/songNavList';

// expo-router 58: el arranque del stack se declara así, no con `initialRouteName`.
export const unstable_settings = { anchor: 'index' };

const isIOS = Platform.OS === 'ios';
const isWeb = Platform.OS === 'web';

/**
 * Stack del Cantoral: Categorías → lista (categoría, etiqueta o búsqueda) →
 * canción → pantalla completa, más «Tu selección». Cada pantalla es un fichero
 * de esta carpeta; los nombres de siempre (`'SongDetail'`…) se traducen a
 * rutas en `utils/eventRoutes.ts` y los params de una canción (texto) se arman
 * en `utils/songNavList.ts`.
 */
export default function CancioneroLayout() {
  const insets = useSafeAreaInsets();
  const webStatusBarHeight = isWeb ? insets.top : undefined;
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  // Re-tap del tab activo → volver a la pantalla raíz del stack. Antes esto lo
  // daba el evento `tabPress` del navegador, pero con la barra del sistema
  // oculta ya no se dispara: ahora lo emite la barra flotante. Devolver `true`
  // le dice a la barra que el gesto ya está gestionado y que NO haga además
  // scroll-arriba.
  useTabReselect('cancionero', () => {
    if (router.canDismiss()) {
      router.dismissAll();
      return true;
    }
    return false;
  });

  // Irse a otro tab y volver NO reinicia el stack: se vuelve a la canción que
  // se estaba mirando. Volver a la raíz está a un toque (re-pulsar el tab).

  useChoirFollower();

  return (
    <SettingsProvider>
      {/* Raya amarilla del cantoral pegada arriba, como la roja de Fotos. */}
      <TabTintBar color={TabHeaderColors.cancionero} />
      <Stack
        screenOptions={{
          headerStyle: isIOS
            ? { backgroundColor: 'transparent' }
            : isWeb
              ? ({
                  backgroundColor: TabHeaderColors.cancionero,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: 'rgba(0, 0, 0, 0.08)',
                } as never)
              : { backgroundColor: TabHeaderColors.cancionero },
          headerTintColor: cantoralHeaderTint(isDark),
          headerTitleStyle: {
            fontWeight: '700' as const,
            fontSize: 17,
            color: isIOS ? (isDark ? '#FFFFFF' : '#000000') : '#1a1a1a',
            letterSpacing: -0.3,
          } as never,
          ...(isWeb &&
            ({ headerStatusBarHeight: webStatusBarHeight } as object)),
          headerTransparent: isIOS,
          // iOS 26+ aplica su propio efecto glass via scrollEdgeEffects;
          // combinarlo con headerBlurEffect provoca solape (warning RNScreens).
          headerBlurEffect:
            isIOS && parseInt(String(Platform.Version), 10) < 26
              ? 'systemChromeMaterial'
              : undefined,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal' as const,
          // Prevents screens from appearing transparent during swipe-back
          // gestures. headerTransparent:true makes the card itself transparent
          // so we must set an explicit background on the content area.
          contentStyle: isIOS
            ? { backgroundColor: themeColors(isDark).backgroundSunken }
            : undefined,
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Cantoral' }} />
        <Stack.Screen
          name={CANTORAL_SLUGS.SongsList}
          options={({ route }) => ({
            title:
              (route.params as { categoryName?: string } | undefined)
                ?.categoryName || 'Canciones',
          })}
        />
        <Stack.Screen
          name={CANTORAL_SLUGS.SongDetail}
          options={{ title: 'Letra y Acordes' }}
        />
        <Stack.Screen
          name={CANTORAL_SLUGS.SongFullscreen}
          options={{ headerShown: false, presentation: 'fullScreenModal' }}
        />
        <Stack.Screen
          name={CANTORAL_SLUGS.SelectedSongs}
          options={{ title: 'Tu selección' }}
        />
      </Stack>
    </SettingsProvider>
  );
}

/**
 * Modo coro - ESCLAVO: cuando el líder cambia la canción, se abre aquí con los
 * datos que ha publicado (puede no estar en el cantoral propio). Si ya se está
 * en el detalle se cambia la canción en el sitio; desde otra pantalla del
 * cantoral se apila. En pantalla completa la sigue la propia pantalla.
 *
 * Antes el stack era un navegador montado a mano y esto navegaba en él aunque
 * se estuviera en otra pestaña. Ahora navegar al cantoral cambia de pestaña,
 * así que fuera de él la canción del líder queda pendiente y se abre al volver.
 */
function useChoirFollower() {
  const choir = useChoirSession();
  const pathname = usePathname();
  const { filename: openFilename } = useGlobalSearchParams<{
    filename?: string;
  }>();
  const inCantoral =
    pathname === CANTORAL_BASE || pathname.startsWith(`${CANTORAL_BASE}/`);
  const handledRef = useRef<string | null>(null);

  const remote = choir.mode === 'slave' ? choir.session?.current : null;
  const remoteKey = remote?.filename
    ? `${remote.filename}@${remote.updatedAt}`
    : null;

  useEffect(() => {
    if (!remote || !remoteKey || !inCantoral) return;
    if (handledRef.current === remoteKey) return;
    handledRef.current = remoteKey;
    const slug = lastSegment(pathname);
    if (slug === CANTORAL_SLUGS.SongFullscreen) return;
    if (slug === CANTORAL_SLUGS.SongDetail && openFilename === remote.filename)
      return;
    const params = songRouteParams({
      filename: remote.filename,
      list: [
        {
          filename: remote.filename,
          title: remote.title ?? remote.filename,
          author: remote.author,
          key: remote.songKey,
          capo: remote.capo,
          content: remote.content ?? '',
          media: extractSongMedia(remote) ?? undefined,
        },
      ],
      currentIndex: 0,
      source: 'selection',
      firebaseCategory: remote.firebaseCategory,
    });
    if (slug === CANTORAL_SLUGS.SongDetail) {
      router.setParams({ firebaseCategory: undefined, ...params });
    } else {
      router.push(cantoralHref('SongDetail', params) as never);
    }
    // Solo cuando el líder cambia de canción o la re-publica (`remoteKey`), o
    // al volver al cantoral con una pendiente. Leer `remote` entero aquí
    // re-dispararía con cada latido de la sesión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteKey, inCantoral]);
}

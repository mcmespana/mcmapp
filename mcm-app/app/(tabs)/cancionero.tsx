import { useTabReselect } from '@/components/tabs/tabBarController';
import { useRef, useEffect } from 'react';
import { createNativeStackNavigator } from 'expo-router/build/react-navigation/native-stack';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';

import CategoriesScreen from '../screens/CategoriesScreen';
import SongListScreen from '../screens/SongListScreen';
import SongDetailScreen from '../screens/SongDetailScreen';
import SongFullscreenScreen from '../screens/SongFullscreenScreen';
import SelectedSongsScreen from '../screens/SelectedSongsScreen';

import { SettingsProvider } from '../../contexts/SettingsContext';
import { TabHeaderColors, UIColors, themeColors } from '@/constants/colors';
import TabTintBar from '@/components/ui/TabTintBar';
import { useChoirSession } from '../../contexts/ChoirSessionContext';
import { extractSongMedia, type SongMedia } from '@/types/songMedia';

export interface SongNavItem {
  title: string;
  filename: string;
  author?: string;
  key?: string;
  capo?: number;
  content?: string;
  media?: SongMedia;
}

export type RootStackParamList = {
  Categories: undefined;
  SongsList: { categoryId: string; categoryName: string };
  SongDetail: {
    filename: string;
    title: string;
    author?: string;
    key?: string;
    capo?: number;
    content: string;
    media?: SongMedia;
    navigationList?: SongNavItem[];
    currentIndex?: number;
    source?: 'category' | 'selection';
    firebaseCategory?: string;
  };
  SongFullscreen: {
    filename: string;
    title: string;
    author?: string;
    key?: string;
    capo?: number;
    content: string;
  };
  SelectedSongs: { p?: string } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const isIOS = Platform.OS === 'ios';
const isWeb = Platform.OS === 'web';

export default function CancioneroTab() {
  const stackNavRef = useRef<any>(null);
  const insets = useSafeAreaInsets();
  const webStatusBarHeight = isWeb ? insets.top : undefined;
  const scheme = useColorScheme();

  // Re-tap del tab activo → volver a la pantalla raíz del stack. Antes esto lo
  // daba el evento `tabPress` del navegador, pero con la barra del sistema
  // oculta ya no se dispara: ahora lo emite la barra flotante. Devolver `true`
  // le dice a la barra que el gesto ya está gestionado y que NO haga además
  // scroll-arriba.
  useTabReselect('cancionero', () => {
    if (stackNavRef.current?.canGoBack()) {
      stackNavRef.current.popToTop();
      return true;
    }
    return false;
  });
  const choir = useChoirSession();

  // Irse a otro tab y volver YA NO reinicia el stack. Antes un `focus` tras un
  // `blur` hacía `popToTop()`, así que salir un momento a Contigo y volver te
  // dejaba en la lista de categorías con la canción que estabas mirando
  // perdida. Volver a la raíz sigue estando a un toque: re-pulsar el tab activo
  // (`useTabReselect`, justo arriba).

  // Modo coro - ESCLAVO: cuando el maestro cambia la canción actual,
  // navegamos automáticamente a SongDetail con los metadatos publicados.
  // Cubre tanto el caso "ya estoy en SongDetail" (navigate hace setParams)
  // como "estoy en otra pantalla del stack" (navigate hace push).
  useEffect(() => {
    if (choir.mode !== 'slave') return;
    const remote = choir.session?.current;
    if (!remote || !remote.filename) return;
    const nav = stackNavRef.current;
    if (!nav) return;
    try {
      const state = nav.getState?.();
      const route = state?.routes?.[state.index];
      if (
        route?.name === 'SongDetail' &&
        (route.params as any)?.filename === remote.filename
      ) {
        return;
      }
    } catch {
      // ignore
    }
    nav.navigate('SongDetail', {
      filename: remote.filename,
      title: remote.title ?? remote.filename,
      author: remote.author,
      key: remote.songKey,
      capo: remote.capo,
      content: remote.content ?? '',
      media: extractSongMedia(remote) ?? undefined,
      firebaseCategory: remote.firebaseCategory,
      source: 'selection',
    });
    // Reaccionamos solo cuando el maestro cambia de canción o re-publica
    // explícitamente (`updatedAt`). Acceder a `choir.session` aquí causaría
    // un re-disparo en cada actualización irrelevante (p. ej. `lastActivity`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    choir.mode,
    choir.session?.current?.filename,
    choir.session?.current?.updatedAt,
  ]);

  return (
    <SettingsProvider>
      {/* Raya amarilla del cantoral pegada arriba, como la roja de Fotos. */}
      <TabTintBar color={TabHeaderColors.cancionero} />
      <Stack.Navigator
        initialRouteName="Categories"
        screenOptions={({ navigation }) => {
          stackNavRef.current = navigation;
          return {
            // Congela las pantallas que no están visibles al cambiar de tab:
            // libera CPU/memoria (especialmente del WebView del detalle).
            freezeOnBlur: true,
            headerStyle: isIOS
              ? { backgroundColor: 'transparent' }
              : isWeb
                ? ({
                    backgroundColor: TabHeaderColors.cancionero,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
                  } as any)
                : ({ backgroundColor: TabHeaderColors.cancionero } as any),
            headerTintColor: isIOS
              ? scheme === 'dark'
                ? UIColors.accentYellow
                : '#3d79b9ff'
              : '#1a1a1a',
            headerTitleStyle: {
              fontWeight: '700' as const,
              fontSize: 17,
              color: isIOS
                ? scheme === 'dark'
                  ? '#FFFFFF'
                  : '#000000'
                : '#1a1a1a',
              letterSpacing: -0.3,
            },
            ...(isWeb &&
              ({ headerStatusBarHeight: webStatusBarHeight } as any)),
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
              ? {
                  backgroundColor: themeColors(scheme === 'dark')
                    .backgroundSunken,
                }
              : undefined,
          };
        }}
      >
        <Stack.Screen
          name="Categories"
          component={CategoriesScreen}
          options={{
            title: 'Cantoral',
          }}
        />
        <Stack.Screen
          name="SongsList"
          component={SongListScreen}
          options={({ route }) => ({
            title: route.params?.categoryName || 'Canciones',
          })}
        />
        <Stack.Screen
          name="SongDetail"
          component={SongDetailScreen}
          options={({ route }) => ({
            title: route.params?.title || 'Letra y Acordes',
          })}
        />
        <Stack.Screen
          name="SongFullscreen"
          component={SongFullscreenScreen}
          options={() => ({
            headerShown: false,
            presentation: 'fullScreenModal',
          })}
        />
        <Stack.Screen
          name="SelectedSongs"
          component={SelectedSongsScreen}
          options={{
            title: 'Seleccionadas',
          }}
        />
      </Stack.Navigator>
    </SettingsProvider>
  );
}

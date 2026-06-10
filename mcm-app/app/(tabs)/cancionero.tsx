import { useNavigation } from 'expo-router';
import { useRef, useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';

import CategoriesScreen from '../screens/CategoriesScreen';
import SongListScreen from '../screens/SongListScreen';
import SongDetailScreen from '../screens/SongDetailScreen';
import SongFullscreenScreen from '../screens/SongFullscreenScreen';
import SelectedSongsScreen from '../screens/SelectedSongsScreen';

import { SettingsProvider } from '../../contexts/SettingsContext';
import { TabHeaderColors } from '@/constants/colors';
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
  // Tracks whether we left this tab (blur) so focus knows to pop to root.
  // We only pop when returning FROM another tab, never on same-tab re-tap.
  // On iOS, NativeTabs (UITabBarController) handles same-tab press natively;
  // our JS handler would conflict with that native behavior and freeze the tab.
  const wasBlurredRef = useRef(false);
  const insets = useSafeAreaInsets();
  const webStatusBarHeight = isWeb ? insets.top : undefined;
  const scheme = useColorScheme();

  const navigation = useNavigation();
  const choir = useChoirSession();

  useEffect(() => {
    const unsubscribeBlur = navigation.addListener('blur' as any, () => {
      wasBlurredRef.current = true;
    });

    // Cross-tab return (blur → focus): pop to root from JS.
    const unsubscribeFocus = navigation.addListener('focus' as any, () => {
      if (!wasBlurredRef.current) return;
      wasBlurredRef.current = false;
      setTimeout(() => {
        if (stackNavRef.current?.canGoBack()) {
          stackNavRef.current.popToTop();
        }
      }, 0);
    });

    // Same-tab re-tap: ahora SEGURO porque `disablePopToTop` (en _layout.tsx)
    // bloquea el popToRootViewController nativo que antes desincronizaba JS
    // y nativo. Hacemos el pop manualmente desde JS para preservar la UX iOS
    // de "tap tab activo → vuelve a la raíz".
    const unsubscribeTabPress = navigation
      .getParent()
      ?.addListener('tabPress' as any, () => {
        if (!(navigation as any).isFocused?.()) return;
        if (stackNavRef.current?.canGoBack()) {
          stackNavRef.current.popToTop();
        }
      });

    return () => {
      unsubscribeBlur();
      unsubscribeFocus();
      unsubscribeTabPress?.();
    };
  }, [navigation]);

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
                ? '#f4c11e'
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
              ? { backgroundColor: scheme === 'dark' ? '#1C1C1E' : '#F2F2F7' }
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

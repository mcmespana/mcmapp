import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform, StyleSheet } from 'react-native';
import GlassHeader from '@/components/ui/GlassHeader.ios';

import CategoriesScreen from '../screens/CategoriesScreen';
import SongListScreen from '../screens/SongListScreen';
import SongDetailScreen from '../screens/SongDetailScreen';
import SongFullscreenScreen from '../screens/SongFullscreenScreen';
import SelectedSongsScreen from '../screens/SelectedSongsScreen';

import { SelectedSongsProvider } from '../../contexts/SelectedSongsContext';
import { SettingsProvider } from '../../contexts/SettingsContext';

export interface SongNavItem {
  title: string;
  filename: string;
  author?: string;
  key?: string;
  capo?: number;
  content?: string;
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
  SelectedSongs: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const HEADER_TINT = '#f4c11e';

export default function CancioneroTab() {
  return (
    <SettingsProvider>
      <SelectedSongsProvider>
        <Stack.Navigator
          initialRouteName="Categories"
          screenOptions={{
            headerBackTitle: 'Volver',
            headerStyle: (Platform.OS === 'ios'
              ? { backgroundColor: 'transparent' }
              : Platform.OS === 'web'
                ? {
                    backgroundColor: HEADER_TINT,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
                  }
                : {
                    backgroundColor: HEADER_TINT,
                  }) as any,
            headerTintColor:
              Platform.OS === 'android' ? '#fff' : '#1a1a1a',
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 17,
              color:
                Platform.OS === 'android' ? '#fff' : '#1a1a1a',
              letterSpacing: -0.3,
            },
            ...(Platform.OS === 'web' &&
              ({ headerStatusBarHeight: 0 } as any)),
            headerTransparent: false,
            headerBackground: () =>
              Platform.OS === 'ios' ? (
                <GlassHeader tintColor={HEADER_TINT} />
              ) : undefined,
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen
            name="Categories"
            component={CategoriesScreen}
            options={{ title: 'Cantoral' }}
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
            options={({ route }) => ({
              title: route.params?.title || 'Pantalla completa',
              headerShown: false,
            })}
          />
          <Stack.Screen
            name="SelectedSongs"
            component={SelectedSongsScreen}
            options={{ title: 'Seleccionadas' }}
          />
        </Stack.Navigator>
      </SelectedSongsProvider>
    </SettingsProvider>
  );
}

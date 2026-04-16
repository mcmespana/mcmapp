import { useNavigation } from 'expo-router';
import { useRef, useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform, StyleSheet } from 'react-native';

import CategoriesScreen from '../screens/CategoriesScreen';
import SongListScreen from '../screens/SongListScreen';
import SongDetailScreen from '../screens/SongDetailScreen';
import SongFullscreenScreen from '../screens/SongFullscreenScreen';
import SelectedSongsScreen from '../screens/SelectedSongsScreen';

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

const isIOS = Platform.OS === 'ios';
const isWeb = Platform.OS === 'web';

export default function CancioneroTab() {
  const stackNavRef = useRef<any>(null);

  const navigation = useNavigation();

  useEffect(() => {
    const unsubscribe = navigation
      .getParent()
      ?.addListener('tabPress' as any, (e: any) => {
        if (stackNavRef.current?.canGoBack()) {
          e.preventDefault?.();
          stackNavRef.current.popToTop();
        }
      });

    return unsubscribe;
  }, [navigation]);

  return (
    <SettingsProvider>
      <Stack.Navigator
        initialRouteName="Categories"
        screenOptions={({ navigation }) => {
          stackNavRef.current = navigation;
          return {
            headerStyle: isIOS
              ? { backgroundColor: 'transparent' }
              : isWeb
                ? ({
                    backgroundColor: '#f4c11e',
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
                  } as any)
                : ({ backgroundColor: '#f4c11e' } as any),
            headerTintColor: isIOS ? '#3d79b9ff' : '#1a1a1a',
            headerTitleStyle: {
              fontWeight: '700' as const,
              fontSize: 17,
              color: isIOS ? '#000' : '#1a1a1a',
              letterSpacing: -0.3,
            },
            ...(isWeb && ({ headerStatusBarHeight: 0 } as any)),
            headerTransparent: isIOS,
            headerBlurEffect: isIOS ? 'systemChromeMaterial' : undefined,
            headerShadowVisible: false,
            headerBackTitle: 'Volver',
            headerBackButtonDisplayMode: 'minimal' as const,
          };
        }}
      >
        <Stack.Screen
          name="Categories"
          component={CategoriesScreen}
          options={{
            title: 'Cantoral',
            headerLargeTitle: isIOS,
            headerLargeTitleShadowVisible: false,
            headerLargeStyle: isIOS
              ? { backgroundColor: 'transparent' }
              : undefined,
          }}
        />
        <Stack.Screen
          name="SongsList"
          component={SongListScreen}
          options={({ route }) => ({
            title: route.params?.categoryName || 'Canciones',
            headerLargeTitle: isIOS,
            headerLargeTitleShadowVisible: false,
            headerLargeStyle: isIOS
              ? { backgroundColor: 'transparent' }
              : undefined,
          })}
        />
        <Stack.Screen
          name="SongDetail"
          component={SongDetailScreen}
          options={({ route }) => ({
            title: route.params?.title || 'Letra y Acordes',
            headerShown: !isIOS,
          })}
        />
        <Stack.Screen
          name="SongFullscreen"
          component={SongFullscreenScreen}
          options={() => ({
            headerShown: false,
          })}
        />
        <Stack.Screen
          name="SelectedSongs"
          component={SelectedSongsScreen}
          options={{
            title: 'Seleccionadas',
            headerLargeTitle: isIOS,
            headerLargeTitleShadowVisible: false,
            headerLargeStyle: isIOS
              ? { backgroundColor: 'transparent' }
              : undefined,
          }}
        />
      </Stack.Navigator>
    </SettingsProvider>
  );
}

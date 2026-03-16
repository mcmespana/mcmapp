import { useEffect, useRef } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, StackActions } from '@react-navigation/native';
import { Platform, StyleSheet } from 'react-native';

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

const isIOS = Platform.OS === 'ios';
const isWeb = Platform.OS === 'web';

export default function CancioneroTab() {
  const tabNavigation = useNavigation();
  const stackNavRef = useRef<any>(null);

  useEffect(() => {
    const unsubscribe = (tabNavigation as any).addListener(
      'tabPress',
      (e: any) => {
        if (stackNavRef.current?.canGoBack()) {
          if (e?.preventDefault) e.preventDefault();
          setTimeout(() => {
            stackNavRef.current?.dispatch(StackActions.popToTop());
          }, 50);
        }
      },
    );
    return unsubscribe;
  }, [tabNavigation]);

  return (
    <SettingsProvider>
      <SelectedSongsProvider>
        <Stack.Navigator
          initialRouteName="Categories"
          screenOptions={({ navigation }) => {
            stackNavRef.current = navigation;
            return {
              // iOS: transparent header for liquid glass effect
              // Android: themed solid header
              // Web: clean minimal header
              headerStyle: isIOS
                ? { backgroundColor: 'transparent' }
                : isWeb
                  ? ({
                    backgroundColor: '#fff',
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
                  } as any)
                  : ({ backgroundColor: '#253883' } as any),
              headerTintColor: isIOS ? '#3d79b9ff' : isWeb ? '#253883' : '#fff',
              headerTitleStyle: {
                fontWeight: '700' as const,
                fontSize: 17,
                color: isIOS ? '#000' : isWeb ? '#1a1a1a' : '#fff',
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
              headerLargeTitle: false,
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

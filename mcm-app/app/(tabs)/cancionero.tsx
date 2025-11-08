import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';
import GlassHeader from '@/components/ui/GlassHeader.ios';

// Importar pantallas
import CategoriesScreen from '../screens/CategoriesScreen';
import SongListScreen from '../screens/SongListScreen';
import SongDetailScreen from '../screens/SongDetailScreen';
import SongFullscreenScreen from '../screens/SongFullscreenScreen';
import SelectedSongsScreen from '../screens/SelectedSongsScreen'; // Import the new screen

// Importar el contexto de canciones seleccionadas
import { SelectedSongsProvider } from '../../contexts/SelectedSongsContext';
// Importar el contexto de configuración
import { SettingsProvider } from '../../contexts/SettingsContext'; // <<<--- ADD THIS IMPORT
// Remove duplicate SongDetailScreen import if present, ensure others are fine.
// Already imported SongDetailScreen above.

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
  SelectedSongs: undefined; // Add SelectedSongs screen
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function CancioneroTab() {
  return (
    // Wrap SelectedSongsProvider with SettingsProvider, or vice versa. Order might matter if one depends on the other.
    // In this case, they are independent, so the order is not critical.
    // Let's put SettingsProvider outside to make settings available to everything within.
    <SettingsProvider>
      <SelectedSongsProvider>
        <Stack.Navigator
          initialRouteName="Categories"
          screenOptions={{
            headerBackTitle: 'Volver',
            headerStyle: Platform.OS === 'ios' 
              ? { backgroundColor: 'transparent' }
              : Platform.OS === 'web'
              ? {
                  backgroundColor: '#f4c11e',
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(0, 0, 0, 0.1)',
                  elevation: 2,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                }
              : {
                  backgroundColor: '#f4c11e',
                },
            headerTintColor: Platform.OS === 'ios' ? '#1a1a1a' : Platform.OS === 'web' ? '#1a1a1a' : '#fff',
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 18,
              color: Platform.OS === 'ios' ? '#1a1a1a' : Platform.OS === 'web' ? '#1a1a1a' : '#fff',
            },
            headerStatusBarHeight: Platform.OS === 'web' ? 0 : undefined,
            headerTransparent: false,
            headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#f4c11e" /> : undefined,
          }}
        >
          <Stack.Screen
            name="Categories"
            component={CategoriesScreen}
            options={{ title: 'Índice de canciones' }}
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
            })}
          />
          <Stack.Screen
            name="SelectedSongs"
            component={SelectedSongsScreen}
            options={{ title: 'Seleccionadas' }}
          />
        </Stack.Navigator>
      </SelectedSongsProvider>
    </SettingsProvider> // <<<--- WRAP HERE
  );
}

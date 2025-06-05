import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';

// Importar pantallas
import CategoriesScreen from '../screens/CategoriesScreen';
import SongListScreen from '../screens/SongListScreen';
import SongDetailScreen from '../screens/SongDetailScreen';
import SelectedSongsScreen from '../screens/SelectedSongsScreen'; // Import the new screen

// Importar el contexto de canciones seleccionadas
import { SelectedSongsProvider } from '../../contexts/SelectedSongsContext';
// Importar el contexto de configuración
import { SettingsProvider } from '../../contexts/SettingsContext'; // <<<--- ADD THIS IMPORT
// Remove duplicate SongDetailScreen import if present, ensure others are fine.
// Already imported SongDetailScreen above.

export type RootStackParamList = {
  Categories: undefined;
  SongsList: { categoryId: string; categoryName: string };
  SongDetail: { filename: string; title: string; author?: string; key?: string; capo?: number; content: string; };
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
          headerStyle: {
            backgroundColor: '#f4c11e',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
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
          options={({ route }) => ({ title: route.params?.categoryName || 'Canciones' })} 
        />
        <Stack.Screen 
          name="SongDetail" 
          component={SongDetailScreen}
          options={({ route }) => ({ 
            title: route.params?.title || 'Letra y Acordes' 
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

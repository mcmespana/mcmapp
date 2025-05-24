import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';

// Importar pantallas
import CategoriesScreen from '../screens/CategoriesScreen';
import SongListScreen from '../screens/SongListScreen';
import SongDetailScreen from '../screens/SongDetailScreen';

export type RootStackParamList = {
  Categories: undefined;
  SongsList: { categoryId: string; categoryName: string };
  SongDetail: { songId: string; songTitle?: string };
};

// Tipos para las props de navegación
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function CancioneroTab() {
  return (
    <Stack.Navigator 
        initialRouteName="Categories"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#f4511e',
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
          options={{ title: 'Categorías' }} 
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
            title: route.params?.songTitle || 'Letra y Acordes' 
          })} 
        />
      </Stack.Navigator>
  );
}

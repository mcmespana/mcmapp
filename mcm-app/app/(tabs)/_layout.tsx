// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons'; // Asegúrate de tenerlo importado
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';

export default function TabsLayout() {
  const scheme = useColorScheme(); //
  const theme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider value={theme}>
      <Tabs
        screenOptions={{
          headerShown: true, // Default to showing headers
          headerTintColor: '#fff', // Default text/icon color for headers
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerTitleAlign: 'center', // Center the title
          tabBarActiveTintColor: Colors[scheme ?? 'light'].tint,
          tabBarInactiveTintColor: Colors[scheme ?? 'light'].icon,
          tabBarStyle: { backgroundColor: Colors[scheme ?? 'light'].background },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Inicio',
            tabBarIcon: ({color, size}) => <MaterialIcons name="home" color={color} size={size}/>,
            headerShown: true
          }}
        />
        <Tabs.Screen
          name="jubileo"
          options={{
            title: 'Jubileo',
            tabBarIcon: ({color, size}) => <MaterialIcons name="celebration" color={color} size={size}/>,
            headerShown: false
          }}
        />
        <Tabs.Screen 
          name="cancionero" 
          options={{
            title: 'Cantoral',
            tabBarIcon: ({color, size}) => <MaterialIcons name="music-note" color={color} size={size}/>,
            headerShown: false // Cantoral uses its own StackNavigator header
          }} 
        />
        <Tabs.Screen
          name="calendario"
          options={{
            title: 'Calendario',
            tabBarIcon: ({color, size}) => <MaterialIcons name="calendar-today" color={color} size={size}/>,
            headerStyle: { backgroundColor: '#A3BD31' } // Éxito / Confirmación color
          }}
        />

        <Tabs.Screen
          name="fotos"
          options={{
            title: 'Fotos',
            tabBarIcon: ({color, size}) => <MaterialIcons name="photo-library" color={color} size={size}/>,
            headerStyle: { backgroundColor: '#E15C62' } // Acento / Call to Action color
          }} 
        />
        <Tabs.Screen 
          name="comunica" 
          options={{
            title: 'Comunica',
            tabBarIcon: ({color, size}) => <MaterialIcons name="public" color={color} size={size}/>,
            headerStyle: { backgroundColor: '#31AADF' } // Info color
          }} 
        />
      </Tabs>
    
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
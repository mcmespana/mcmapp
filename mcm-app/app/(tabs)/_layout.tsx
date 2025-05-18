// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons'; // Asegúrate de tenerlo importado
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/hooks/useColorScheme';
import colors from '@/constants/colors'; //

export default function TabsLayout() {
  const scheme = useColorScheme(); //
  const theme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider value={theme}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary, //
          tabBarInactiveTintColor: colors.secondary, //
          tabBarStyle: { backgroundColor: colors.background }, //
        }}
      >
        <Tabs.Screen 
          name="index" 
          options={{
            title: 'Inicio',
            tabBarIcon: ({color, size}) => <MaterialIcons name="home" color={color} size={size}/>
          }} 
        />
        <Tabs.Screen 
          name="comunica" 
          options={{
            title: 'Comunica',
            tabBarIcon: ({color, size}) => <MaterialIcons name="public" color={color} size={size}/>
          }} 
        />
        <Tabs.Screen 
          name="cancionero" 
          options={{
            title: 'Cantoral',
            tabBarIcon: ({color, size}) => <MaterialIcons name="music-note" color={color} size={size}/>
          }} 
        />
        <Tabs.Screen 
          name="calendario" 
          options={{
            title: 'Calendario',
            tabBarIcon: ({color, size}) => <MaterialIcons name="calendar-today" color={color} size={size}/>
          }} 
        />
        <Tabs.Screen 
          name="fotos" 
          options={{
            title: 'Fotos',
            tabBarIcon: ({color, size}) => <MaterialIcons name="photo-library" color={color} size={size}/>
          }} 
        />
        {/* Nueva pestaña para el log de notificaciones */}
        <Tabs.Screen
          name="notificationsLog" // Nombre del archivo (sin .tsx)
          options={{
            title: 'Avisos', // Título de la pestaña
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="notifications" color={color} size={size} />
            ),
          }}
        />
      </Tabs>
    
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
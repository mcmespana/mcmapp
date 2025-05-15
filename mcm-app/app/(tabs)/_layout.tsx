// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/hooks/useColorScheme';
import colors from '@/constants/colors';

export default function TabsLayout() {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider value={theme}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.secondary,
          tabBarStyle: { backgroundColor: colors.background },
        }}
      >
        <Tabs.Screen 
          name="home" 
          options={{ 
            title: 'Quiénes somos', 
            tabBarIcon: ({ color, size }) => <MaterialIcons name="home" color={color} size={size}/> 
          }} 
        />
        <Tabs.Screen 
          name="horario" 
          options={{ 
            title: 'Horario', 
            tabBarIcon: ({ color, size }) => <MaterialIcons name="schedule" color={color} size={size}/> 
          }} 
        />
        <Tabs.Screen 
          name="cancionero" 
          options={{ 
            title: 'Cancionero', 
            tabBarIcon: ({ color, size }) => <MaterialIcons name="music-note" color={color} size={size}/> 
          }} 
        />
        <Tabs.Screen 
          name="documentos" 
          options={{ 
            title: 'Documentos', 
            tabBarIcon: ({ color, size }) => <MaterialIcons name="description" color={color} size={size}/> 
          }} 
        />
        <Tabs.Screen 
          name="calendario" 
          options={{ 
            title: 'Calendario', 
            tabBarIcon: ({ color, size }) => <MaterialIcons name="calendar-today" color={color} size={size}/> 
          }} 
        />
        <Tabs.Screen 
          name="fotos" 
          options={{ 
            title: 'Fotos', 
            tabBarIcon: ({ color, size }) => <MaterialIcons name="photo-library" color={color} size={size}/> 
          }} 
        />
      </Tabs>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

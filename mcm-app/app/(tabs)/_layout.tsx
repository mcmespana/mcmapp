// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons'; // Asegúrate de tenerlo importado
import {
  ThemeProvider,
  DarkTheme,
  DefaultTheme,
} from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { Platform } from 'react-native';

export default function TabsLayout() {
  const scheme = useColorScheme(); //
  const theme = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const featureFlags = useFeatureFlags();

  return (
    <ThemeProvider value={theme}>
      <Tabs
        initialRouteName={featureFlags.defaultTab}
        screenOptions={{
          headerShown: true,
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: 18,
          },
          headerTitleAlign: 'center',
          headerStatusBarHeight: Platform.OS === 'web' ? 0 : undefined,
          tabBarActiveTintColor: Colors[scheme ?? 'light'].tint,
          tabBarInactiveTintColor: Colors[scheme ?? 'light'].icon,
          tabBarStyle: {
            backgroundColor: Colors[scheme ?? 'light'].background,
          },
        }}
      >
        {featureFlags.tabs.index && (
          <Tabs.Screen
            name="index"
            options={{
              title: 'Inicio',
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons name="home" color={color} size={size} />
              ),
              headerShown: true,
            }}
          />
        )}
        {featureFlags.tabs.jubileo && (
          <Tabs.Screen
            name="jubileo"
            options={{
              title: 'Jubileo',
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons name="celebration" color={color} size={size} />
              ),
              headerShown: false,
            }}
          />
        )}
        {featureFlags.tabs.cancionero && (
          <Tabs.Screen
            name="cancionero"
            options={{
              title: 'Cantoral',
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons name="music-note" color={color} size={size} />
              ),
              headerShown: false, // Cantoral uses its own StackNavigator header
            }}
          />
        )}
        {featureFlags.tabs.calendario && (
          <Tabs.Screen
            name="calendario"
            options={{
              title: 'Calendario',
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons
                  name="calendar-today"
                  color={color}
                  size={size}
                />
              ),
              headerStyle: { backgroundColor: '#31AADF' }, // Éxito / Confirmación color
            }}
          />
        )}

        {featureFlags.tabs.fotos && (
          <Tabs.Screen
            name="fotos"
            options={{
              title: 'Fotos',
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons name="photo-library" color={color} size={size} />
              ),
              headerStyle: { backgroundColor: '#E15C62' }, // Acento / Call to Action color
            }}
          />
        )}
        {featureFlags.tabs.cuentas && (
          <Tabs.Screen
            name="cuentas"
            options={{
              title: 'Cuentas',
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons
                  name="account-balance"
                  color={color}
                  size={size}
                />
              ),
              headerStyle: { backgroundColor: '#4CAF50' }, // Verde para cuentas
            }}
          />
        )}
        {featureFlags.tabs.comunica && (
          <Tabs.Screen
            name="comunica"
            options={{
              title: 'Comunica',
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons name="public" color={color} size={size} />
              ),
              headerStyle: { backgroundColor: '#9D1E74dd' }, // Info color
            }}
          />
        )}
      </Tabs>

      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

// app/(tabs)/_layout.tsx - Hybrid Tabs Implementation
// iOS: NativeTabs for liquid glass compatibility
// Android/Web: Traditional Tabs for better functionality
import React from 'react';
import { Platform } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { StatusBar } from 'expo-status-bar';

// Import iOS-specific NativeTabs
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { MaterialIcons } from '@expo/vector-icons';

// Import Android/Web-specific Traditional Tabs
import { Tabs } from 'expo-router';
import {
  ThemeProvider,
  DarkTheme,
  DefaultTheme,
} from '@react-navigation/native';
import { Colors } from '@/constants/colors';
import { HapticTab } from '@/components/HapticTab';
import { BlurView } from 'expo-blur';
import GlassHeader from '@/components/ui/GlassHeader.ios';

// iOS NativeTabs Component
function iOSNativeTabsLayout() {
  const featureFlags = useFeatureFlags();

  return (
    <NativeTabs>
      {featureFlags.tabs.index && (
        <NativeTabs.Trigger name="index">
          <Label>Inicio</Label>
          <Icon sf={{ default: 'house', selected: 'house.fill' }} />
        </NativeTabs.Trigger>
      )}

      {featureFlags.tabs.cancionero && (
        <NativeTabs.Trigger name="cancionero">
          <Label>Cantoral</Label>
          <Icon sf={{ default: 'music.note', selected: 'music.note' }} />
        </NativeTabs.Trigger>
      )}

      {featureFlags.tabs.calendario && (
        <NativeTabs.Trigger name="calendario">
          <Label>Calendario</Label>
          <Icon sf={{ default: 'calendar', selected: 'calendar' }} />
        </NativeTabs.Trigger>
      )}

      {featureFlags.tabs.fotos && (
        <NativeTabs.Trigger name="fotos">
          <Label>Fotos</Label>
          <Icon sf={{ default: 'photo', selected: 'photo.fill' }} />
        </NativeTabs.Trigger>
      )}

      {featureFlags.tabs.comunica && (
        <NativeTabs.Trigger name="comunica">
          <Label>Comunica</Label>
          <Icon sf={{ default: 'globe', selected: 'globe' }} />
        </NativeTabs.Trigger>
      )}

      {featureFlags.tabs.mas && (
        <NativeTabs.Trigger name="mas">
          <Label>Más</Label>
          <Icon sf={{ default: 'ellipsis', selected: 'ellipsis' }} />
        </NativeTabs.Trigger>
      )}
    </NativeTabs>
  );
}

// Android/Web Traditional Tabs Component
function AndroidWebTabsLayout() {
  const scheme = useColorScheme();
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
            borderTopWidth: 1,
            borderTopColor: Colors[scheme ?? 'light'].icon + '20',
            paddingBottom: Platform.OS === 'web' ? 8 : 0,
            paddingTop: 8,
            height: Platform.OS === 'web' ? 70 : 60,
          },
          tabBarButton: HapticTab,
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
              headerStyle: { backgroundColor: '#31AADF' },
              headerTransparent: false,
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
              headerStyle: { backgroundColor: '#E15C62' },
              headerTransparent: false,
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
              headerStyle: { backgroundColor: '#9D1E74dd' },
              headerTransparent: false,
            }}
          />
        )}
        {featureFlags.tabs.mas && (
          <Tabs.Screen
            name="mas"
            options={{
              title: 'Más',
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons name="more-horiz" color={color} size={size} />
              ),
              headerShown: false,
            }}
          />
        )}
      </Tabs>
    </ThemeProvider>
  );
}

// Main TabsLayout Component - Platform-specific rendering
export default function TabsLayout() {
  const scheme = useColorScheme();

  return (
    <>
      {Platform.OS === 'ios' ? (
        <iOSNativeTabsLayout />
      ) : (
        <AndroidWebTabsLayout />
      )}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}
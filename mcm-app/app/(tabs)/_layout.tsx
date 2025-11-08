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
import { Colors, TabHeaderColors } from '@/constants/colors';
import { HapticTab } from '@/components/HapticTab';

// ============================================================================
// CENTRALIZED TABS CONFIGURATION
// ============================================================================
interface TabConfig {
  name: string;
  label: string;
  iosIcon: {
    default: string;
    selected: string;
  };
  androidIcon: string;
  headerColor?: string;
  headerShown?: boolean;
}

const TABS_CONFIG: TabConfig[] = [
  {
    name: 'index',
    label: 'Inicio',
    iosIcon: { default: 'house', selected: 'house.fill' },
    androidIcon: 'home',
    headerShown: true,
  },
  {
    name: 'cancionero',
    label: 'Cantoral',
    iosIcon: { default: 'music.note', selected: 'music.note' },
    androidIcon: 'music-note',
    headerShown: false, // Cantoral uses its own StackNavigator header
  },
  {
    name: 'calendario',
    label: 'Calendario',
    iosIcon: { default: 'calendar', selected: 'calendar' },
    androidIcon: 'calendar-today',
    headerColor: TabHeaderColors.calendario,
    headerShown: true,
  },
  {
    name: 'fotos',
    label: 'Fotos',
    iosIcon: { default: 'photo', selected: 'photo.fill' },
    androidIcon: 'photo-library',
    headerColor: TabHeaderColors.fotos,
    headerShown: true,
  },
  {
    name: 'comunica',
    label: 'Comunica',
    iosIcon: { default: 'globe', selected: 'globe' },
    androidIcon: 'public',
    headerColor: TabHeaderColors.comunica,
    headerShown: true,
  },
  {
    name: 'mas',
    label: 'Más',
    iosIcon: { default: 'ellipsis', selected: 'ellipsis' },
    androidIcon: 'more-horiz',
    headerShown: false,
  },
];

// ============================================================================
// iOS NativeTabs Component
// ============================================================================
function IOSNativeTabsLayout() {
  const featureFlags = useFeatureFlags();

  return (
    <NativeTabs>
      {TABS_CONFIG.map((tab) => {
        const isEnabled = featureFlags.tabs[tab.name as keyof typeof featureFlags.tabs];

        if (!isEnabled) return null;

        return (
          <NativeTabs.Trigger key={tab.name} name={tab.name}>
            <Label>{tab.label}</Label>
            <Icon sf={tab.iosIcon} />
          </NativeTabs.Trigger>
        );
      })}
    </NativeTabs>
  );
}

// ============================================================================
// Android/Web Traditional Tabs Component
// ============================================================================
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
            paddingBottom: Platform.OS === 'web' ? 12 : 8,
            paddingTop: 12,
            height: Platform.OS === 'web' ? 60 : 80,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 3,
          },
          tabBarButton: HapticTab,
          animation: 'shift',
        }}
      >
        {TABS_CONFIG.map((tab) => {
          const isEnabled = featureFlags.tabs[tab.name as keyof typeof featureFlags.tabs];

          if (!isEnabled) return null;

          return (
            <Tabs.Screen
              key={tab.name}
              name={tab.name}
              options={{
                title: tab.label,
                tabBarIcon: ({ color, size }) => (
                  <MaterialIcons name={tab.androidIcon as any} color={color} size={size} />
                ),
                headerShown: tab.headerShown ?? true,
                ...(tab.headerColor && {
                  headerStyle: { backgroundColor: tab.headerColor },
                  headerTransparent: false,
                }),
              }}
            />
          );
        })}
      </Tabs>
    </ThemeProvider>
  );
}

// ============================================================================
// Main TabsLayout Component - Platform-specific rendering
// ============================================================================
export default function TabsLayout() {
  const scheme = useColorScheme();

  return (
    <>
      {Platform.OS === 'ios' ? (
        <IOSNativeTabsLayout />
      ) : (
        <AndroidWebTabsLayout />
      )}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

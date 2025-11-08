// app/_layout.tsx

import '../notifications/NotificationHandler';   // Inicializa el handler de notificaciones
import usePushNotifications from '../notifications/usePushNotifications'; // Hook para notificaciones push

import React, { useState, useEffect, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  ThemeProvider as NavThemeProvider,
  DarkTheme,
  DefaultTheme,
} from '@react-navigation/native';
import { usePathname, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useStatusBarTheme } from '@/hooks/useStatusBarTheme';
import { AppSettingsProvider } from '@/contexts/AppSettingsContext';
import { FeatureFlagsProvider, useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import {
  UserProfileProvider,
  useUserProfile,
} from '@/contexts/UserProfileContext';
import UserProfileModal from '@/components/UserProfileModal';
import { HelloWave } from '@/components/HelloWave'; // Import HelloWave
import AddToHomeBanner from '@/components/AddToHomeBanner';
import {
  Provider as PaperProvider,
  MD3LightTheme,
  MD3DarkTheme,
} from 'react-native-paper';
import colors from '@/constants/colors';

// Importar iconos para asegurar que se incluyan en el build
import '@/constants/iconAssets';

export default function RootLayout() {
  return (
    <FeatureFlagsProvider>
      <AppSettingsProvider>
        <UserProfileProvider>
          <InnerLayout />
        </UserProfileProvider>
      </AppSettingsProvider>
    </FeatureFlagsProvider>
  );
}

function InnerLayout() {
  const [showAnimation, setShowAnimation] = useState(true);
  const scheme = useColorScheme(); // Keep existing hooks
  const pathname = usePathname();
  const { profile, loading: profileLoading } = useUserProfile();
  const [profileVisible, setProfileVisible] = useState(false);
  const featureFlags = useFeatureFlags();

  // Hook para actualizar el tema de la barra de estado dinámicamente
  useStatusBarTheme(pathname);

  // Configuración del tema de Paper
  const paperTheme = useMemo(() => {
    const base = scheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
    return { ...base, colors: { ...base.colors, primary: colors.success } };
  }, [scheme]);

  // Configuración del tema de navegación
  const navigationTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  useEffect(() => {
    // The HelloWave animation repeats 4 times, each sequence is 150ms + 150ms = 300ms.
    // Total animation time = 4 * 300ms = 1200ms.
    // Let's give it a bit more, say 1500ms (1.5 seconds), before hiding.
    const timer = setTimeout(() => {
      setShowAnimation(false);
    }, 1500); // Adjust timing as needed

    return () => clearTimeout(timer); // Cleanup timer on unmount
  }, []);

  useEffect(() => {
    if (showAnimation) return;
    if (featureFlags.showUserProfilePrompt && !profileLoading && (!profile.name || !profile.location)) {
      setProfileVisible(true);
    }
  }, [showAnimation, profileLoading, profile, featureFlags.showUserProfilePrompt]);

  // Inicializa el sistema de notificaciones push
  usePushNotifications();

  if (showAnimation) {
    return (
      <View style={styles.animationContainer}>
        <HelloWave />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={paperTheme}>
          <NavThemeProvider value={navigationTheme}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="wordle"
                options={{
                  headerShown: true,
                  title: 'Wordle Jubileo',
                }}
              />
              <Stack.Screen
                name="notifications"
                options={{ headerShown: false }}
              />
            </Stack>
            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
            <AddToHomeBanner />
            <UserProfileModal
              visible={profileVisible}
              onClose={() => setProfileVisible(false)}
            />
          </NavThemeProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Add a StyleSheet for the animation container
const styles = StyleSheet.create({
  animationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff', // Or use a theme color
  },
});

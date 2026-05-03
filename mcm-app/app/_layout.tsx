// app/_layout.tsx

import '../notifications/NotificationHandler'; // Inicializa el handler de notificaciones
import usePushNotifications from '../notifications/usePushNotifications'; // Hook para notificaciones push

import React, { useState, useEffect, useCallback } from 'react';
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
import {
  FeatureFlagsProvider,
  useFeatureFlags,
} from '@/contexts/FeatureFlagsContext';
import {
  UserProfileProvider,
  useUserProfile,
} from '@/contexts/UserProfileContext';
import {
  SelectedSongsProvider,
  useSelectedSongs,
} from '@/contexts/SelectedSongsContext';
import { useIncomingPlaylist } from '@/hooks/useIncomingPlaylist';
import { useRegisterServiceWorker } from '@/hooks/useRegisterServiceWorker';
import UserProfileModal from '@/components/UserProfileModal';
import { HelloWave } from '@/components/HelloWave';
import AddToHomeBanner from '@/components/AddToHomeBanner';
import ErrorBoundary from '@/components/ErrorBoundary';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import UniwindThemeBridge from '@/components/UniwindThemeBridge';
import { HeroUINativeProvider, useToast } from 'heroui-native';
// Importar iconos para asegurar que se incluyan en el build
import '@/constants/iconAssets';

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <HeroUINativeProvider>
            <FeatureFlagsProvider>
              <AppSettingsProvider>
                <UniwindThemeBridge />
                <UserProfileProvider>
                  <SelectedSongsProvider>
                    <NotificationsProvider>
                      <InnerLayout />
                    </NotificationsProvider>
                  </SelectedSongsProvider>
                </UserProfileProvider>
              </AppSettingsProvider>
            </FeatureFlagsProvider>
          </HeroUINativeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

function InnerLayout() {
  const [showAnimation, setShowAnimation] = useState(true);
  const scheme = useColorScheme();
  const pathname = usePathname();
  const { profile, loading: profileLoading } = useUserProfile();
  const [profileVisible, setProfileVisible] = useState(false);
  const featureFlags = useFeatureFlags();
  const { addSong } = useSelectedSongs();
  const { toast } = useToast();

  // Handle incoming .mcm files (opened from WhatsApp, Files, etc.)
  const handleIncomingPlaylist = useCallback(
    (songs: string[]) => {
      songs.forEach((fn) => addSong(fn));
      toast.show({
        label: `Playlist importada (${songs.length} ${songs.length === 1 ? 'canción' : 'canciones'})`,
        actionLabel: 'OK',
        onActionPress: ({ hide }) => hide(),
      });
    },
    [addSong, toast],
  );
  useIncomingPlaylist(handleIncomingPlaylist);

  // Hook para actualizar el tema de la barra de estado dinámicamente
  useStatusBarTheme(pathname);

  // Configuración del tema de navegación
  const navigationTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowAnimation(false);
    }, 900);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (showAnimation) return;
    if (
      featureFlags.showUserProfilePrompt &&
      !profileLoading &&
      (!profile.name || !profile.location)
    ) {
      setProfileVisible(true);
    }
  }, [
    showAnimation,
    profileLoading,
    profile,
    featureFlags.showUserProfilePrompt,
  ]);

  // Inicializa el sistema de notificaciones push
  usePushNotifications();

  // Registra el service worker en web (PWA)
  useRegisterServiceWorker();

  if (showAnimation) {
    return (
      <View style={styles.animationContainer}>
        <HelloWave />
      </View>
    );
  }

  return (
    <NavThemeProvider value={navigationTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen
          name="wordle"
          options={{
            headerShown: true,
            title: 'Wordle Jubileo',
          }}
        />
      </Stack>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <AddToHomeBanner />
      <UserProfileModal
        visible={profileVisible}
        onClose={() => setProfileVisible(false)}
      />
    </NavThemeProvider>
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

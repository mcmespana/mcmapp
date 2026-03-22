// app/_layout.tsx

import '../notifications/NotificationHandler'; // Inicializa el handler de notificaciones
import usePushNotifications from '../notifications/usePushNotifications'; // Hook para notificaciones push

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import UserProfileModal from '@/components/UserProfileModal';
import { HelloWave } from '@/components/HelloWave';
import AddToHomeBanner from '@/components/AddToHomeBanner';
import ErrorBoundary from '@/components/ErrorBoundary';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import {
  Provider as PaperProvider,
  MD3LightTheme,
  MD3DarkTheme,
  Snackbar,
} from 'react-native-paper';
import colors from '@/constants/colors';

// Importar iconos para asegurar que se incluyan en el build
import '@/constants/iconAssets';

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <FeatureFlagsProvider>
        <AppSettingsProvider>
          <UserProfileProvider>
            <SelectedSongsProvider>
              <NotificationsProvider>
                <InnerLayout />
              </NotificationsProvider>
            </SelectedSongsProvider>
          </UserProfileProvider>
        </AppSettingsProvider>
      </FeatureFlagsProvider>
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
  const [importSnackbar, setImportSnackbar] = useState('');

  // Handle incoming .mcm files (opened from WhatsApp, Files, etc.)
  const handleIncomingPlaylist = useCallback(
    (songs: string[]) => {
      songs.forEach((fn) => addSong(fn));
      setImportSnackbar(
        `Playlist importada (${songs.length} ${songs.length === 1 ? 'canción' : 'canciones'})`,
      );
    },
    [addSong],
  );
  useIncomingPlaylist(handleIncomingPlaylist);

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
                name="notifications"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="wordle"
                options={{
                  headerShown: true,
                  title: 'Wordle Jubileo',
                }}
              />
              <Stack.Screen
                name="screens/EvangelioScreen"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="screens/OracionScreen"
                options={{ headerShown: false }}
              />
            </Stack>
            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
            <AddToHomeBanner />
            <UserProfileModal
              visible={profileVisible}
              onClose={() => setProfileVisible(false)}
            />
            <Snackbar
              visible={!!importSnackbar}
              onDismiss={() => setImportSnackbar('')}
              duration={3000}
              action={{
                label: 'OK',
                onPress: () => setImportSnackbar(''),
              }}
              style={{
                backgroundColor: scheme === 'dark' ? '#3A3A3C' : '#1C1C1E',
                borderRadius: 12,
                marginBottom: 90,
                marginHorizontal: 16,
              }}
            >
              {importSnackbar}
            </Snackbar>
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

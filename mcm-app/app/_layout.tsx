// app/_layout.tsx

import '../notifications/NotificationHandler'; // Inicializa el handler de notificaciones
import usePushNotifications from '../notifications/usePushNotifications'; // Hook para notificaciones push

import React, { useState, useEffect, useCallback } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  ThemeProvider as NavThemeProvider,
  DarkTheme,
  DefaultTheme,
} from '@react-navigation/native';
import { usePathname, useSegments, router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useStatusBarTheme } from '@/hooks/useStatusBarTheme';
import { AppSettingsProvider } from '@/contexts/AppSettingsContext';
import { ProfileConfigProvider } from '@/contexts/ProfileConfigContext';
import {
  UserProfileProvider,
  useUserProfile,
} from '@/contexts/UserProfileContext';
import {
  SelectedSongsProvider,
  useSelectedSongs,
} from '@/contexts/SelectedSongsContext';
import { useIncomingPlaylist } from '@/hooks/useIncomingPlaylist';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import { isAppVersionSupported } from '@/utils/resolveProfileConfig';
import { HelloWave } from '@/components/HelloWave';
import AddToHomeBanner from '@/components/AddToHomeBanner';
import ErrorBoundary from '@/components/ErrorBoundary';
import MaintenanceScreen from '@/components/MaintenanceScreen';
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
            <ProfileConfigProvider>
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
            </ProfileConfigProvider>
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
  const segments = useSegments();
  const { profile, loading: profileLoading } = useUserProfile();
  const resolved = useResolvedProfileConfig();
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

  useStatusBarTheme(pathname);

  const navigationTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowAnimation(false);
    }, 900);
    return () => clearTimeout(timer);
  }, []);

  // Redirigir al onboarding si:
  //   - la config global pide onboarding (`showOnboarding`)
  //   - el usuario no lo ha completado ni lo ha saltado (`profileType === null`)
  // El banner de la Home se ocupará del caso "saltado" (profileType definido pero `onboardingCompleted === false`).
  useEffect(() => {
    if (showAnimation) return;
    if (profileLoading) return;
    if (!resolved.showOnboarding) return;
    if (profile.profileType !== null) return;
    // Evitar redirigir si ya estamos en la pantalla de onboarding.
    // (segments[0] está tipado por expo-router con las rutas conocidas; la
    //  ruta `onboarding` es un Stack.Screen registrado más abajo, no se
    //  detecta automáticamente — comparación con cast.)
    if ((segments[0] as string) === 'onboarding') return;
    router.replace('/onboarding' as any);
  }, [
    showAnimation,
    profileLoading,
    resolved.showOnboarding,
    profile.profileType,
    segments,
  ]);

  usePushNotifications();

  if (showAnimation) {
    return (
      <View style={styles.animationContainer}>
        <HelloWave />
      </View>
    );
  }

  // Kill switches remotos: mantenimiento + versión mínima
  if (resolved.maintenanceMode) {
    return (
      <MaintenanceScreen
        mode="maintenance"
        message={resolved.maintenanceMessage}
      />
    );
  }
  const currentVersion = String(Constants.expoConfig?.version ?? '0.0.0');
  if (!isAppVersionSupported(currentVersion, resolved.minAppVersion)) {
    return (
      <MaintenanceScreen
        mode="update"
        minVersion={resolved.minAppVersion}
        currentVersion={currentVersion}
      />
    );
  }

  return (
    <NavThemeProvider value={navigationTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen
          name="onboarding"
          options={{ headerShown: false, presentation: 'modal' }}
        />
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
    </NavThemeProvider>
  );
}

const styles = StyleSheet.create({
  animationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});

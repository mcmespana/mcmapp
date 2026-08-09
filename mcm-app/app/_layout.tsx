// app/_layout.tsx

// Sentry el PRIMERO de todos los imports: se arranca como efecto de cargar el
// módulo, así que cuanto antes se importe, más crashes de arranque captura.
// Sin `EXPO_PUBLIC_SENTRY_DSN` no hace absolutamente nada.
import { wrapRoot } from '@/utils/sentry';

import '../notifications/NotificationHandler'; // Inicializa el handler de notificaciones
import usePushNotifications from '../notifications/usePushNotifications'; // Hook para notificaciones push

import React, { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  ThemeProvider as NavThemeProvider,
  DarkTheme,
  DefaultTheme,
} from 'expo-router/react-navigation';
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
import { ChoirSessionProvider } from '@/contexts/ChoirSessionContext';
import { useIncomingPlaylist } from '@/hooks/useIncomingPlaylist';
import { useRegisterServiceWorker } from '@/hooks/useRegisterServiceWorker';
import { useScreenTracking } from '@/hooks/useScreenTracking';
import { trackEvent } from '@/utils/analytics';
import { tramoTamano } from '@/constants/analyticsEvents';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import { HelloWave } from '@/components/HelloWave';
import AddToHomeBanner from '@/components/AddToHomeBanner';
import CommandPalette from '@/components/CommandPalette';
import ErrorBoundary from '@/components/ErrorBoundary';
import MaintenanceScreen from '@/components/MaintenanceScreen';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { EventSubscriptionsProvider } from '@/contexts/EventSubscriptionsContext';
import { CalendarConfigProvider } from '@/contexts/CalendarConfigContext';
import { OverlayStackProvider } from '@/contexts/OverlayStackContext';
import UniwindThemeBridge from '@/components/UniwindThemeBridge';
import { HeroUINativeProvider } from 'heroui-native';
import { AppToastProvider, useToast } from '@/contexts/AppToastContext';
import OTAUpdatePrompt from '@/components/OTAUpdatePrompt';
import { OTAProvider, useOTAContext } from '@/contexts/OTAContext';
import { PreviewChannelProvider } from '@/contexts/PreviewChannelContext';
import { PreviewChannelModal } from '@/components/PreviewChannelModal';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { updateUserMCMData } from '@/utils/authHelpers';
import FirebaseConfigErrorScreen from '@/components/FirebaseConfigErrorScreen';
import { CarismochitoProvider } from '@/contexts/CarismochitoContext';
import CarismochitoOverlay from '@/components/CarismochitoOverlay';
import { ActiveEventProvider } from '@/contexts/ActiveEventContext';
import {
  VersionGateProvider,
  useVersionGate,
} from '@/contexts/VersionGateContext';
// Importar iconos para asegurar que se incluyan en el build
import '@/constants/iconAssets';

function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <HeroUINativeProvider
            config={{ devInfo: { stylingPrinciples: false } }}
          >
            <AppToastProvider>
              <OverlayStackProvider>
                <ProfileConfigProvider>
                  <AppSettingsProvider>
                    <UniwindThemeBridge />
                    <UserProfileProvider>
                      <EventSubscriptionsProvider>
                        <AuthProvider>
                          <SelectedSongsProvider>
                            <ChoirSessionProvider>
                              <NotificationsProvider>
                                <CalendarConfigProvider>
                                  <PreviewChannelProvider>
                                    <OTAProvider>
                                      <CarismochitoProvider>
                                        <ActiveEventProvider>
                                          <VersionGateProvider>
                                            <InnerLayout />
                                          </VersionGateProvider>
                                        </ActiveEventProvider>
                                      </CarismochitoProvider>
                                    </OTAProvider>
                                  </PreviewChannelProvider>
                                </CalendarConfigProvider>
                              </NotificationsProvider>
                            </ChoirSessionProvider>
                          </SelectedSongsProvider>
                        </AuthProvider>
                      </EventSubscriptionsProvider>
                    </UserProfileProvider>
                  </AppSettingsProvider>
                </ProfileConfigProvider>
              </OverlayStackProvider>
            </AppToastProvider>
          </HeroUINativeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

function InnerLayout() {
  const [showAnimation, setShowAnimation] = useState(true);
  const { isReady, isDownloading, applyUpdate, dismissed, setDismissed } =
    useOTAContext();
  const scheme = useColorScheme();
  const pathname = usePathname();
  const segments = useSegments();
  const { profile, loading: profileLoading } = useUserProfile();
  const { user: authUser, configError: firebaseConfigError } = useAuth();
  const resolved = useResolvedProfileConfig();
  const {
    updateRequired,
    updateSkipped,
    skipUpdate,
    currentVersion: appVersion,
    minAppVersion,
  } = useVersionGate();

  // Sync MCM profile data to RTDB whenever user is logged in and profile changes
  useEffect(() => {
    if (!authUser) return;
    updateUserMCMData(authUser.uid, {
      profileType: profile.profileType,
      delegationId: profile.delegationId,
      onboardingCompleted: profile.onboardingCompleted,
    });
  }, [
    authUser,
    profile.profileType,
    profile.delegationId,
    profile.onboardingCompleted,
  ]);
  const { addSong } = useSelectedSongs();
  const { toast } = useToast();

  // Handle incoming .mcm files (opened from WhatsApp, Files, etc.)
  const handleIncomingPlaylist = useCallback(
    (songs: string[]) => {
      songs.forEach((fn) => addSong(fn));
      trackEvent('playlist_usada', {
        accion: 'importada',
        tamano: tramoTamano(songs.length),
      });
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
  // Analítica: arranca Aptabase y registra cada cambio de pantalla. Sin
  // EXPO_PUBLIC_APTABASE_KEY no hace nada.
  useScreenTracking();

  const navigationTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    AsyncStorage.getItem('seenWelcomeOnce')
      .then((seen) => {
        if (seen) {
          setShowAnimation(false);
          return;
        }
        AsyncStorage.setItem('seenWelcomeOnce', '1').catch(() => {});
        timer = setTimeout(() => setShowAnimation(false), 600);
      })
      .catch(() => {
        timer = setTimeout(() => setShowAnimation(false), 600);
      });
    return () => clearTimeout(timer);
  }, []);

  // Redirigir al onboarding si:
  //   - la config global pide onboarding (`showOnboarding`)
  //   - el usuario no lo ha completado ni lo ha saltado (`profileType === null`)
  // El banner de la Home se ocupará del caso "saltado" (profileType definido pero `onboardingCompleted === false`).
  useEffect(() => {
    if (showAnimation) return;
    if (profileLoading) return;
    if (Platform.OS === 'web') return; // Omitir onboarding inicial en plataforma web
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

  // Registra el service worker en web (PWA)
  useRegisterServiceWorker();

  if (showAnimation) {
    return (
      <View
        style={[
          styles.animationContainer,
          scheme === 'dark' && styles.animationContainerDark,
        ]}
      >
        <HelloWave />
      </View>
    );
  }

  // Firebase mal configurado — pantalla de diagnóstico para el desarrollador
  if (firebaseConfigError) {
    return <FirebaseConfigErrorScreen error={firebaseConfigError} />;
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
  if (updateRequired && !updateSkipped) {
    return (
      <MaintenanceScreen
        mode="update"
        minVersion={minAppVersion}
        currentVersion={appVersion}
        onSkip={skipUpdate}
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
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            contentStyle: { backgroundColor: '#253883' },
          }}
        />
        <Stack.Screen
          name="wordle"
          options={{
            headerShown: true,
            title: 'Wordle Jubileo',
          }}
        />
        <Stack.Screen name="evaluacion-app" options={{ headerShown: false }} />
        <Stack.Screen name="encuesta/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="playlist"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <AddToHomeBanner />
      <CommandPalette />
      <OTAUpdatePrompt
        visible={(isReady || isDownloading) && !dismissed}
        isDownloading={isDownloading && !isReady}
        onApply={applyUpdate}
        onLater={() => setDismissed(true)}
      />
      <PreviewChannelModal />
      <CarismochitoOverlay />
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
  animationContainerDark: {
    backgroundColor: '#2C2C2E',
  },
});

// `wrapRoot` es la identidad cuando Sentry está apagado (sin DSN), así que el
// árbol de componentes no cambia en absoluto en ese caso.
export default wrapRoot(RootLayout);

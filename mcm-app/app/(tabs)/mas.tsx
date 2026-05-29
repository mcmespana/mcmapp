import React, { useState, useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import { useNavigation } from 'expo-router';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MasHomeScreen from '../screens/MasHomeScreen';
import ComunicaScreen from '../screens/ComunicaScreen';
import ComunicaGestionScreen from '../screens/ComunicaGestionScreen';
import AlbumListScreen from '../screens/AlbumListScreen';
import CalendarioScreen from './calendario';
import EventosPasadosScreen from '../screens/EventosPasadosScreen';
import SettingsBottomSheet from '@/components/SettingsBottomSheet';
import {
  EventStackParamList,
  eventStackScreenOptions,
  renderEventScreens,
} from '../screens/eventStackScreens';

/**
 * Stack del tab "Más". Incluye las pantallas propias de Más más todas las
 * sub-pantallas de evento (compartidas con las tabs de evento vía
 * `app/screens/eventStackScreens.tsx`).
 */
export type MasStackParamList = EventStackParamList & {
  MasHome: { directTo?: string } | undefined;
  Fotos: undefined;
  Calendario: undefined;
  Comunica: undefined;
  ComunicaGestion: undefined;
  EventosPasados: undefined;
};

const Stack = createNativeStackNavigator<MasStackParamList>();

export default function MasTab() {
  const [settingsVisible, setSettingsVisible] = useState(false);
  const stackNavRef = useRef<any>(null);
  // Tracks whether we left this tab (blur) so focus knows to pop to root.
  // We only pop when returning FROM another tab, never on same-tab re-tap.
  // On iOS, NativeTabs (UITabBarController) handles same-tab press natively;
  // our JS handler would conflict with that native behavior and freeze the tab.
  const wasBlurredRef = useRef(false);
  const insets = useSafeAreaInsets();
  const webStatusBarHeight = Platform.OS === 'web' ? insets.top : undefined;

  const navigation = useNavigation();

  useEffect(() => {
    const unsubscribeBlur = navigation.addListener('blur' as any, () => {
      wasBlurredRef.current = true;
    });

    // Cross-tab return (blur → focus): pop to root from JS.
    const unsubscribeFocus = navigation.addListener('focus' as any, () => {
      if (!wasBlurredRef.current) return;
      wasBlurredRef.current = false;
      setTimeout(() => {
        if (stackNavRef.current?.canGoBack()) {
          stackNavRef.current.popToTop();
        }
      }, 0);
    });

    // Same-tab re-tap: ahora SEGURO porque `disablePopToTop` (en _layout.tsx)
    // bloquea el popToRootViewController nativo que antes desincronizaba JS
    // y nativo. Hacemos el pop manualmente desde JS para preservar la UX iOS
    // de "tap tab activo → vuelve a la raíz".
    const unsubscribeTabPress = navigation
      .getParent()
      ?.addListener('tabPress' as any, () => {
        if (!(navigation as any).isFocused?.()) return;
        if (stackNavRef.current?.canGoBack()) {
          stackNavRef.current.popToTop();
        }
      });

    return () => {
      unsubscribeBlur();
      unsubscribeFocus();
      unsubscribeTabPress?.();
    };
  }, [navigation]);

  return (
    <>
      <SettingsBottomSheet
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
      <Stack.Navigator
        initialRouteName="MasHome"
        screenOptions={eventStackScreenOptions({
          onSettings: () => setSettingsVisible(true),
          webStatusBarHeight,
          onNavReady: (nav) => {
            stackNavRef.current = nav;
          },
        })}
      >
        <Stack.Screen
          name="MasHome"
          component={MasHomeScreen}
          options={{
            title: 'Más',
            headerShown: false,
            headerRight: undefined,
          }}
        />
        <Stack.Screen
          name="Fotos"
          component={AlbumListScreen}
          options={{
            // Fotos se comporta como un tab "de plataforma" (cantoral,
            // calendario): pinta su franja de color desde TabScreenWrapper
            // dentro de la propia pantalla en lugar de un header pesado.
            // El gesto de swipe-back de iOS / botón nativo Android cubren
            // la navegación de vuelta.
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="Calendario"
          component={CalendarioScreen}
          options={{
            // Calendario se comporta como un tab "de plataforma": pinta su
            // propio header/contenido vía TabScreenWrapper. El swipe-back de
            // iOS / botón nativo Android cubren la navegación de vuelta.
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="Comunica"
          component={ComunicaScreen}
          options={{
            headerShown: false, // Pantalla completa — sin header
          }}
        />
        <Stack.Screen
          name="ComunicaGestion"
          component={ComunicaGestionScreen}
          options={{
            headerShown: false, // Pantalla completa — sin header
          }}
        />
        <Stack.Screen
          name="EventosPasados"
          component={EventosPasadosScreen}
          options={{
            title: 'Eventos pasados',
            // No es una pantalla de evento: sin botones settings/reflexiones.
            headerRight: () => null,
          }}
        />
        {renderEventScreens(Stack as never, { includeExtras: true })}
      </Stack.Navigator>
    </>
  );
}

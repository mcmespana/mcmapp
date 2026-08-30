import React, { useState, useRef } from 'react';
import { Platform } from 'react-native';
import { useTabReselect } from '@/components/tabs/tabBarController';
import { createNativeStackNavigator } from 'expo-router/build/react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';

import MasHomeScreen from '../screens/MasHomeScreen';
import ComunicaScreen from '../screens/ComunicaScreen';
import ComunicaGestionScreen from '../screens/ComunicaGestionScreen';
import McmPanelScreen from '../screens/McmPanelScreen';
import AlbumListScreen from '../screens/AlbumListScreen';
import { CalendarScreen } from './calendario';
import EventosPasadosScreen from '../screens/EventosPasadosScreen';
import SettingsBottomSheet from '@/components/SettingsBottomSheet';
import EventActionButtons from '@/components/EventActionButtons';
import {
  EVENT_SUB_ROUTES,
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
  McmPanel: undefined;
  EventosPasados: undefined;
};

const Stack = createNativeStackNavigator<MasStackParamList>();

export default function MasTab() {
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [activeRoute, setActiveRoute] = useState<string>('MasHome');
  const [activeEventId, setActiveEventId] = useState<string | undefined>(
    undefined,
  );
  const stackNavRef = useRef<any>(null);
  const insets = useSafeAreaInsets();
  const webStatusBarHeight = Platform.OS === 'web' ? insets.top : undefined;
  const isDark = useColorScheme() === 'dark';

  // Re-tap del tab activo → volver a la pantalla raíz del stack. Antes esto lo
  // daba el evento `tabPress` del navegador, pero con la barra del sistema
  // oculta ya no se dispara: ahora lo emite la barra flotante. Devolver `true`
  // le dice a la barra que el gesto ya está gestionado y que NO haga además
  // scroll-arriba.
  useTabReselect('mas', () => {
    if (stackNavRef.current?.canGoBack()) {
      stackNavRef.current.popToTop();
      return true;
    }
    return false;
  });

  // Igual que en el cantoral: salir a otro tab y volver ya NO reinicia el
  // stack. Se sale un momento a mirar otra cosa y se vuelve a donde se estaba.
  // Para volver a la raíz, re-pulsar el tab (`useTabReselect`, justo arriba).

  return (
    <>
      <SettingsBottomSheet
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
      <Stack.Navigator
        initialRouteName="MasHome"
        screenOptions={eventStackScreenOptions({
          webStatusBarHeight,
          isDark,
          onNavReady: (nav) => {
            stackNavRef.current = nav;
          },
        })}
        screenListeners={{
          state: (e) => {
            const navState: any = (e.data as any)?.state;
            const route = navState?.routes?.[navState.index];
            if (route?.name) {
              setActiveRoute(route.name);
              setActiveEventId(route.params?.eventId);
            }
          },
        }}
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
          component={CalendarScreen}
          options={{
            // CalendarScreen pone su propio título ("Calendario") y el botón de
            // calendarios vía navigation.setOptions, usando el header nativo del
            // stack de "Más".
            title: 'Calendario',
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
          name="McmPanel"
          component={McmPanelScreen}
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
      {(EVENT_SUB_ROUTES as readonly string[]).includes(activeRoute) && (
        <EventActionButtons
          onSettings={() => setSettingsVisible(true)}
          onCompartiendo={() =>
            stackNavRef.current?.navigate('Reflexiones', {
              eventId: activeEventId,
            })
          }
          showCompartiendo={activeRoute !== 'Reflexiones'}
          showAdd={activeRoute === 'Reflexiones'}
          onAdd={() =>
            stackNavRef.current?.navigate('Reflexiones', {
              eventId: activeEventId,
              openFormNonce: Date.now(),
            })
          }
        />
      )}
    </>
  );
}

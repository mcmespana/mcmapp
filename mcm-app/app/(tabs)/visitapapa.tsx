import React, { useState, useRef, useEffect } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { useNavigation } from 'expo-router';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import EventHomeScreen from '../screens/EventHomeScreen';
import SettingsBottomSheet from '@/components/SettingsBottomSheet';
import EventActionButtons from '@/components/EventActionButtons';
import { getEvent } from '@/constants/events';
import {
  EVENT_SUB_ROUTES,
  EventStackParamList,
  eventHubScreenOptions,
  eventStackScreenOptions,
  renderEventScreens,
} from '../screens/eventStackScreens';

const EVENT_ID = 'visitapapa26';

/**
 * Tab del evento activo "Visita Papa León XIV 2026" (modo evento).
 *
 * Reusa el mismo stack genérico de evento que el tab "Más" (Jubileo) pero con
 * su propio header y `eventId` fijo (`visitapapa26`) inyectado vía
 * `initialParams`. Para crear otra actividad-tab basta con duplicar este
 * archivo cambiando el `eventId` + registrar el tab en los catálogos.
 */
const Stack = createNativeStackNavigator<EventStackParamList>();

export default function VisitaPapaTab() {
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [activeRoute, setActiveRoute] = useState<string>('JubileoHome');
  const stackNavRef = useRef<any>(null);
  const wasBlurredRef = useRef(false);
  const insets = useSafeAreaInsets();
  const webStatusBarHeight = Platform.OS === 'web' ? insets.top : undefined;

  const navigation = useNavigation();
  const sectionColor = getEvent(EVENT_ID).tintColor;

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

    // Same-tab re-tap: pop a la raíz desde JS (ver nota en mas.tsx).
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
        initialRouteName="JubileoHome"
        screenOptions={eventStackScreenOptions({
          webStatusBarHeight,
          onNavReady: (nav) => {
            stackNavRef.current = nav;
          },
        })}
        screenListeners={{
          state: (e) => {
            const navState: any = (e.data as any)?.state;
            const route = navState?.routes?.[navState.index];
            if (route?.name) setActiveRoute(route.name);
          },
        }}
      >
        <Stack.Screen
          name="JubileoHome"
          component={EventHomeScreen}
          initialParams={{ eventId: EVENT_ID }}
          options={eventHubScreenOptions}
        />
        {renderEventScreens(Stack, { skipHub: true, includeExtras: false })}
      </Stack.Navigator>
      {(EVENT_SUB_ROUTES as readonly string[]).includes(activeRoute) && (
        <EventActionButtons
          onSettings={() => setSettingsVisible(true)}
          onCompartiendo={() =>
            stackNavRef.current?.navigate('Reflexiones', { eventId: EVENT_ID })
          }
          showCompartiendo={activeRoute !== 'Reflexiones'}
          showAdd={activeRoute === 'Reflexiones'}
          onAdd={() =>
            stackNavRef.current?.navigate('Reflexiones', {
              eventId: EVENT_ID,
              openFormNonce: Date.now(),
            })
          }
        />
      )}
      {/* Barra de color superior de la sección (estilo iOS de Calendario/Fotos),
          por encima de todo el stack. */}
      <View
        style={[styles.topColorBar, { backgroundColor: sectionColor }]}
        pointerEvents="none"
      />
    </>
  );
}

const styles = StyleSheet.create({
  topColorBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    zIndex: 1001,
  },
});

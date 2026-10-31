import React, { useEffect, useRef, useState } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { Stack, router, useNavigation, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabReselect } from '@/components/tabs/tabBarController';
import { useColorScheme } from '@/hooks/useColorScheme';
import SettingsBottomSheet from '@/components/SettingsBottomSheet';
import EventActionButtons from '@/components/EventActionButtons';
import { getEvent } from '@/constants/events';
import { EventBaseContext, EventIdContext } from '@/hooks/useCurrentEvent';
import { takePendingEventScreen } from '@/utils/eventNavigation';
import {
  EVENT_SUB_SLUGS,
  EVENT_SLUGS,
  VISITAPAPA_BASE,
  eventHref,
  lastSegment,
} from '@/utils/eventRoutes';
import {
  eventHubScreenOptions,
  eventStackScreenOptions,
  renderEventScreens,
} from '@/app/screens/eventStackScreens';

const EVENT_ID = 'visitapapa26';

// expo-router 58: el arranque del stack se declara así, no con `initialRouteName`.
export const unstable_settings = { anchor: 'index' };

/**
 * Tab del evento activo "Visita Papa León XIV 2026" (modo evento).
 *
 * Reusa las mismas pantallas de evento que el tab "Más" (Jubileo), cada una un
 * fichero de esta carpeta, pero con su propio header y `eventId` fijo
 * (`visitapapa26`) inyectado vía `EventIdContext`. Para crear otra
 * actividad-tab basta con duplicar esta carpeta cambiando el `eventId` +
 * registrar el tab en los catálogos.
 */
export default function VisitaPapaLayout() {
  const [settingsVisible, setSettingsVisible] = useState(false);
  const wasBlurredRef = useRef(false);
  const insets = useSafeAreaInsets();
  const webStatusBarHeight = Platform.OS === 'web' ? insets.top : undefined;
  const isDark = useColorScheme() === 'dark';
  const activeSlug = lastSegment(usePathname());

  // En un layout, `useNavigation()` es el de la RUTA de la pestaña (el del
  // navegador de pestañas): da los eventos de foco/desenfoque del tab.
  const navigation = useNavigation();

  // Re-tap del tab activo → volver a la pantalla raíz del stack. Antes esto lo
  // daba el evento `tabPress` del navegador, pero con la barra del sistema
  // oculta ya no se dispara: ahora lo emite la barra flotante. Devolver `true`
  // le dice a la barra que el gesto ya está gestionado y que NO haga además
  // scroll-arriba.
  useTabReselect('visitapapa', () => {
    if (router.canDismiss()) {
      router.dismissAll();
      return true;
    }
    return false;
  });
  const sectionColor = getEvent(EVENT_ID).tintColor;

  useEffect(() => {
    const unsubscribeBlur = navigation.addListener('blur' as never, () => {
      wasBlurredRef.current = true;
    });

    // Cross-tab return (blur → focus): volver a la raíz desde JS. Pero si hay un
    // destino pendiente (p.ej. el banner "Evalúa" de la Home), navegamos a él
    // en vez de volver a la raíz.
    const unsubscribeFocus = navigation.addListener('focus' as never, () => {
      const pendingScreen = takePendingEventScreen();
      if (pendingScreen) {
        wasBlurredRef.current = false;
        setTimeout(() => {
          router.push(
            eventHref(
              VISITAPAPA_BASE,
              pendingScreen.screen as never,
              pendingScreen.params,
            ) as never,
          );
        }, 0);
        return;
      }
      if (!wasBlurredRef.current) return;
      wasBlurredRef.current = false;
      setTimeout(() => {
        if (router.canDismiss()) router.dismissAll();
      }, 0);
    });

    return () => {
      unsubscribeBlur();
      unsubscribeFocus();
    };
  }, [navigation]);

  return (
    <>
      <SettingsBottomSheet
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
      <EventIdContext.Provider value={EVENT_ID}>
        <EventBaseContext.Provider value={VISITAPAPA_BASE}>
          <Stack
            screenOptions={eventStackScreenOptions({
              webStatusBarHeight,
              isDark,
            })}
          >
            <Stack.Screen
              name="index"
              options={(args) =>
                eventHubScreenOptions({
                  ...args,
                  route: {
                    params: { eventId: EVENT_ID, ...args.route.params },
                  },
                })
              }
            />
            {renderEventScreens({ includeExtras: false })}
          </Stack>
        </EventBaseContext.Provider>
      </EventIdContext.Provider>
      {EVENT_SUB_SLUGS.includes(activeSlug) && (
        <EventActionButtons
          onSettings={() => setSettingsVisible(true)}
          onCompartiendo={() =>
            router.push(
              eventHref(VISITAPAPA_BASE, 'Reflexiones', {
                eventId: EVENT_ID,
              }) as never,
            )
          }
          showCompartiendo={activeSlug !== EVENT_SLUGS.Reflexiones}
          showAdd={activeSlug === EVENT_SLUGS.Reflexiones}
          onAdd={() =>
            router.push(
              eventHref(VISITAPAPA_BASE, 'Reflexiones', {
                eventId: EVENT_ID,
                openFormNonce: Date.now(),
              }) as never,
            )
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

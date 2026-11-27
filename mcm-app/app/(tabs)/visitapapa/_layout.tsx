import React, { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Stack, router, useNavigation, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabReselect } from '@/components/tabs/tabBarController';
import { useColorScheme } from '@/hooks/useColorScheme';
import SettingsBottomSheet from '@/components/SettingsBottomSheet';
import EventActionButtons from '@/components/EventActionButtons';
import { EventBaseContext, EventIdContext } from '@/hooks/useCurrentEvent';
import { useActiveMeta } from '@/contexts/ActiveEventContext';
import { takePendingEventScreen } from '@/utils/eventNavigation';
import {
  EVENT_ACTION_SLUGS,
  EVENT_SLUGS,
  VISITAPAPA_BASE,
  eventHref,
  lastSegment,
} from '@/utils/eventRoutes';
import { requestReflexionComposer } from '@/utils/reflexionesComposerRequests';
import {
  eventHubScreenOptions,
  eventStackScreenOptions,
  renderEventScreens,
} from '@/app/screens/eventStackScreens';

// expo-router 58: el arranque del stack se declara así, no con `initialRouteName`.
export const unstable_settings = { anchor: 'index' };

/**
 * Tab del evento EN CURSO (modo evento). La carpeta se llama `visitapapa` por
 * historia: es el hueco de la barra que ocupa el evento activo, sea cual sea
 * (`activities/_meta.activeEventId`). Hoy la Visita del Papa (archivada) y el
 * Congreso M+C; los dos declaran `tabId: 'visitapapa'` en `constants/events.ts`.
 *
 * Reusa las mismas pantallas de evento que el tab "Más" (Jubileo), cada una un
 * fichero de esta carpeta, pero con su propio header y el `eventId` del evento
 * activo inyectado vía `EventIdContext`.
 */
export default function VisitaPapaLayout() {
  const { activeEventId: EVENT_ID } = useActiveMeta();
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
      {EVENT_ACTION_SLUGS.includes(activeSlug) && (
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
          // El «+» NO navega: avisa a la pantalla de Compartiendo que se
          // está viendo para que abra su compositor. Navegar a la misma ruta
          // apilaba otra copia idéntica a cada toque (el bucle de 2026-11).
          onAdd={() => {
            if (requestReflexionComposer()) return;
            router.push(
              eventHref(VISITAPAPA_BASE, 'Reflexiones', {
                eventId: EVENT_ID,
                openComposer: '1',
              }) as never,
            );
          }}
        />
      )}
    </>
  );
}

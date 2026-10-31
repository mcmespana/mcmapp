import React, { useState } from 'react';
import { Platform } from 'react-native';
import { Stack, router, useGlobalSearchParams, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabReselect } from '@/components/tabs/tabBarController';
import { useColorScheme } from '@/hooks/useColorScheme';
import { themeColors } from '@/constants/colors';
import { fotosHeaderOptions } from '@/app/screens/FotosScreen';
import SettingsBottomSheet from '@/components/SettingsBottomSheet';
import EventActionButtons from '@/components/EventActionButtons';
import {
  EVENT_SUB_SLUGS,
  EVENT_SLUGS,
  MAS_BASE,
  eventHref,
  lastSegment,
} from '@/utils/eventRoutes';
import {
  eventStackScreenOptions,
  renderEventScreens,
} from '@/app/screens/eventStackScreens';

// expo-router 58: el arranque del stack se declara así, no con `initialRouteName`.
export const unstable_settings = { anchor: 'index' };

/**
 * Stack del tab "Más". Incluye las pantallas propias de Más más todas las
 * sub-pantallas de evento (las mismas que usan las tabs de evento, vía
 * `app/screens/eventStackScreens.tsx`). Cada pantalla es un fichero de esta
 * carpeta; los nombres de pantalla de siempre (`'Fotos'`, `'Horario'`…) se
 * traducen a rutas en `utils/eventRoutes.ts`.
 */
export default function MasLayout() {
  const [settingsVisible, setSettingsVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const webStatusBarHeight = Platform.OS === 'web' ? insets.top : undefined;
  const isDark = useColorScheme() === 'dark';
  const activeSlug = lastSegment(usePathname());
  const { eventId: activeEventId } = useGlobalSearchParams<{
    eventId?: string;
  }>();

  // Re-tap del tab activo → volver a la pantalla raíz del stack. Antes esto lo
  // daba el evento `tabPress` del navegador, pero con la barra del sistema
  // oculta ya no se dispara: ahora lo emite la barra flotante. Devolver `true`
  // le dice a la barra que el gesto ya está gestionado y que NO haga además
  // scroll-arriba.
  useTabReselect('mas', () => {
    if (router.canDismiss()) {
      router.dismissAll();
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
      <Stack
        screenOptions={eventStackScreenOptions({ webStatusBarHeight, isDark })}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'Más',
            headerShown: false,
            headerRight: undefined,
          }}
        />
        <Stack.Screen
          name="fotos"
          options={{
            // La MISMA pantalla que el tab de Fotos, como hace Calendario
            // (antes era AlbumListScreen, una copia antigua que en Android
            // quedaba bajo la barra de pestañas flotante y en web no tenía
            // botón de volver). Con su header transparente, que es con el que
            // cuenta la pantalla; aquí con título, porque no hay pestaña que
            // diga dónde estás.
            ...fotosHeaderOptions(isDark),
            title: 'Fotos',
            headerTitleStyle: {
              fontWeight: '700' as const,
              color: themeColors(isDark).headerTint,
            },
          }}
        />
        <Stack.Screen
          name="calendario"
          options={{
            // CalendarScreen pone su propio título ("Calendario") y el botón de
            // calendarios vía navigation.setOptions, usando el header nativo del
            // stack de "Más".
            title: 'Calendario',
          }}
        />
        <Stack.Screen
          name="comunica"
          options={{
            headerShown: false, // Pantalla completa — sin header
          }}
        />
        <Stack.Screen
          name="comunica-gestion"
          options={{
            headerShown: false, // Pantalla completa — sin header
          }}
        />
        <Stack.Screen
          name="mcm-panel"
          options={{
            headerShown: false, // Pantalla completa — sin header
          }}
        />
        <Stack.Screen
          name="eventos-pasados"
          options={{
            title: 'Eventos pasados',
            // No es una pantalla de evento: sin botones settings/reflexiones.
            headerRight: () => null,
          }}
        />
        {renderEventScreens({ includeHub: true, includeExtras: true })}
      </Stack>
      {EVENT_SUB_SLUGS.includes(activeSlug) && (
        <EventActionButtons
          onSettings={() => setSettingsVisible(true)}
          onCompartiendo={() =>
            router.push(
              eventHref(MAS_BASE, 'Reflexiones', {
                eventId: activeEventId,
              }) as never,
            )
          }
          showCompartiendo={activeSlug !== EVENT_SLUGS.Reflexiones}
          showAdd={activeSlug === EVENT_SLUGS.Reflexiones}
          onAdd={() =>
            router.push(
              eventHref(MAS_BASE, 'Reflexiones', {
                eventId: activeEventId,
                openFormNonce: Date.now(),
              }) as never,
            )
          }
        />
      )}
    </>
  );
}

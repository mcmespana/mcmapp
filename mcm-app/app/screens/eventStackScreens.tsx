import React from 'react';
import { View, Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { PressableFeedback } from 'heroui-native';

import GlassHeader from '@/components/ui/GlassHeader.ios';
import { getEvent } from '@/constants/events';

import EventHomeScreen from './EventHomeScreen';
import HorarioScreen from './HorarioScreen';
import MaterialesScreen from './MaterialesScreen';
import MaterialPagesScreen from './MaterialPagesScreen';
import VisitasScreen from './VisitasScreen';
import ProfundizaScreen from './ProfundizaScreen';
import GruposScreen from './GruposScreen';
import ContactosScreen from './ContactosScreen';
import AppsScreen from './AppsScreen';
import ReflexionesScreen from './ReflexionesScreen';
import ComidaScreen from './ComidaScreen';
import ComidaWebScreen from './ComidaWebScreen';
import WordleScreen from './WordleScreen';

/**
 * Plumbing compartido del stack de un evento (Jubileo, Visita Papa, etc.).
 *
 * Las sub-pantallas de evento son las mismas en todos los eventos; este módulo
 * las registra una sola vez para que las consuman tanto el tab "Más"
 * (`app/(tabs)/mas.tsx`) como las tabs de evento propias (ej.
 * `app/(tabs)/visitapapa.tsx`). Añadir una actividad-tab nueva = un archivo
 * fino + 1 entrada en `constants/events.ts`.
 */

/**
 * Route params comunes a todas las pantallas de un evento. El `eventId` se
 * resuelve en `constants/events.ts` para saber de qué path de Firebase leer y
 * qué colores usar en el header. Si no se pasa, se usa el evento por defecto.
 */
export type EventRouteParams = { eventId?: string };

/** Pantallas comunes a cualquier evento. */
export type EventStackParamList = {
  JubileoHome: EventRouteParams | undefined;
  Horario: EventRouteParams | undefined;
  Materiales: (EventRouteParams & { initialDayIndex?: number }) | undefined;
  MaterialPages: EventRouteParams & { actividad: any; fecha: string };
  Visitas: EventRouteParams | undefined;
  Comida: EventRouteParams | undefined;
  ComidaWeb: EventRouteParams & { url: string; title: string };
  Profundiza: EventRouteParams | undefined;
  Grupos: EventRouteParams | undefined;
  Contactos: EventRouteParams | undefined;
  Apps: EventRouteParams | undefined;
  Wordle: EventRouteParams | undefined;
  Reflexiones: EventRouteParams | undefined;
};

type EventStackNavigator = ReturnType<
  typeof createNativeStackNavigator<EventStackParamList>
>;

type EventScreenRoute = { params?: { eventId?: string } };

// Helper para obtener estilos del header según la plataforma.
// Web sigue el mismo patrón ligero que el cantoral: fondo tintado + hairline,
// sin sombra pesada — así los headers se sienten coherentes en toda la app.
export const getHeaderStyle = (tintColor: string) => {
  if (Platform.OS === 'ios') {
    return { backgroundColor: 'transparent' };
  } else if (Platform.OS === 'web') {
    return {
      backgroundColor: tintColor,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0, 0, 0, 0.08)',
      elevation: 0,
      shadowOpacity: 0,
    };
  } else {
    return { backgroundColor: tintColor };
  }
};

// Helper para obtener el color del texto del header.
// iOS y web usan siempre texto oscuro (coherente con el resto de tabs, p.ej.
// el cantoral, que pinta texto oscuro sobre su franja de color). Antes web
// volteaba a blanco para tints medios/oscuros (el verde de Jubileo), lo que
// rompía la coherencia visual con el resto de la app. Android sigue la
// convención Material de texto blanco sobre la barra de color.
// (El parámetro se mantiene por compatibilidad de firma.)
export const getTextColor = (_tintColor?: string) => {
  return Platform.OS === 'android' ? '#fff' : '#1a1a1a';
};

/**
 * Opciones de header para una pantalla de evento. El color se deriva del
 * `eventId` del route param — cae al evento por defecto si falta. Esto permite
 * reusar todas las sub-pantallas para eventos nuevos sin duplicar registros.
 */
export const eventScreenOptions =
  (title: string) =>
  ({ route }: { route: EventScreenRoute }) => {
    const event = getEvent(route.params?.eventId);
    const tint = event.tintColor;
    const textColor = getTextColor(tint);
    return {
      title,
      headerStyle: getHeaderStyle(tint),
      headerTintColor: textColor,
      // Quita la sombra pesada bajo la barra de color (coherente con el
      // cantoral). En web/android `shadowOpacity`/`elevation` del headerStyle
      // no bastan: la sombra se controla con esta prop.
      headerShadowVisible: false,
      headerTitleStyle: {
        fontWeight: '700' as const,
        fontSize: 18,
        color: textColor,
      },
      headerBackground: () =>
        Platform.OS === 'ios' ? <GlassHeader tintColor={tint} /> : undefined,
    };
  };

/** Igual que eventScreenOptions pero usa `event.title` y oculta headerRight. */
export const eventHubScreenOptions = ({
  route,
}: {
  route: EventScreenRoute;
}) => {
  const event = getEvent(route.params?.eventId);
  return {
    ...eventScreenOptions(event.title)({ route }),
    headerRight: undefined,
  };
};

/**
 * Botones del header derecho en las sub-pantallas de evento (ajustes +
 * reflexiones). No se muestran en el hub ni en pantallas no-evento.
 */
export function eventHeaderRight({
  navigation,
  route,
  onSettings,
}: {
  navigation: any;
  route: { name: string; params?: { eventId?: string } };
  onSettings: () => void;
}) {
  const isEventScreen =
    route.name !== 'MasHome' &&
    route.name !== 'JubileoHome' &&
    route.name !== 'Fotos';
  if (!isEventScreen) return null;

  const eventId = route.params?.eventId;
  const iconColor = getTextColor(getEvent(eventId).tintColor);

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}
    >
      <PressableFeedback onPress={onSettings} style={{ padding: 10 }}>
        <PressableFeedback.Highlight />
        <MaterialIcons name="settings" size={26} color={iconColor} />
      </PressableFeedback>
      {route.name !== 'Reflexiones' && (
        <PressableFeedback
          onPress={() => navigation.navigate('Reflexiones', { eventId })}
          style={{ padding: 10 }}
        >
          <PressableFeedback.Highlight />
          <MaterialIcons name="forum" size={26} color={iconColor} />
        </PressableFeedback>
      )}
    </View>
  );
}

/**
 * Builder del `screenOptions` del Stack.Navigator de un evento. Replica el
 * header gris por defecto (que cada pantalla sobreescribe con su tint vía
 * `eventScreenOptions`) y los botones settings/reflexiones.
 *
 * @param onSettings   abre el bottom sheet de ajustes del tab.
 * @param onNavReady   recibe el `navigation` del stack activo (para popToTop).
 */
export function eventStackScreenOptions({
  onSettings,
  webStatusBarHeight,
  onNavReady,
}: {
  onSettings: () => void;
  webStatusBarHeight?: number;
  onNavReady?: (navigation: any) => void;
}) {
  return ({ navigation, route }: { navigation: any; route: any }) => {
    onNavReady?.(navigation);
    return {
      freezeOnBlur: true,
      headerBackTitle: 'Atrás',
      headerStyle:
        Platform.OS === 'ios'
          ? { backgroundColor: 'transparent' }
          : Platform.OS === 'web'
            ? {
                backgroundColor: '#78909C',
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(0, 0, 0, 0.08)',
                elevation: 0,
                shadowOpacity: 0,
              }
            : { backgroundColor: '#78909C' },
      headerTintColor: Platform.OS === 'ios' ? '#1a1a1a' : '#fff',
      headerShadowVisible: false,
      headerTitleStyle: {
        fontWeight: '700' as const,
        fontSize: 18,
        color: Platform.OS === 'ios' ? '#1a1a1a' : '#fff',
      },
      headerTitleAlign: 'center' as const,
      headerStatusBarHeight: webStatusBarHeight,
      headerTransparent: false,
      headerBackground: () =>
        Platform.OS === 'ios' ? <GlassHeader tintColor="#78909C" /> : undefined,
      headerRight: () => eventHeaderRight({ navigation, route, onSettings }),
    };
  };
}

/**
 * Registra las sub-pantallas de un evento dentro de un Stack.Navigator.
 *
 * @param opts.skipHub        no registra `JubileoHome` (lo registra el tab con
 *                            sus `initialParams`).
 * @param opts.includeExtras  registra Comida/ComidaWeb/Wordle (solo Jubileo;
 *                            Visita Papa usa una sección-enlace para la comida).
 */
export function renderEventScreens(
  Stack: EventStackNavigator,
  opts?: { skipHub?: boolean; includeExtras?: boolean },
) {
  const { skipHub = false, includeExtras = false } = opts ?? {};
  return (
    <>
      {!skipHub && (
        <Stack.Screen
          name="JubileoHome"
          component={EventHomeScreen}
          options={eventHubScreenOptions}
        />
      )}
      <Stack.Screen
        name="Horario"
        component={HorarioScreen}
        options={eventScreenOptions('Horario')}
      />
      <Stack.Screen
        name="Materiales"
        component={MaterialesScreen}
        options={eventScreenOptions('Materiales')}
      />
      <Stack.Screen
        name="MaterialPages"
        component={MaterialPagesScreen}
        options={eventScreenOptions('Material')}
      />
      <Stack.Screen
        name="Visitas"
        component={VisitasScreen}
        options={eventScreenOptions('Visitas')}
      />
      <Stack.Screen
        name="Profundiza"
        component={ProfundizaScreen}
        options={eventScreenOptions('Profundiza')}
      />
      <Stack.Screen
        name="Grupos"
        component={GruposScreen}
        options={eventScreenOptions('Grupos')}
      />
      <Stack.Screen
        name="Contactos"
        component={ContactosScreen}
        options={eventScreenOptions('Contactos')}
      />
      <Stack.Screen
        name="Apps"
        component={AppsScreen}
        options={eventScreenOptions('Apps')}
      />
      <Stack.Screen
        name="Reflexiones"
        component={ReflexionesScreen}
        options={eventScreenOptions('Compartiendo')}
      />
      {includeExtras && (
        <>
          <Stack.Screen
            name="Comida"
            component={ComidaScreen}
            options={eventScreenOptions('Comida')}
          />
          <Stack.Screen
            name="ComidaWeb"
            component={ComidaWebScreen}
            options={eventScreenOptions('Comida')}
          />
          <Stack.Screen
            name="Wordle"
            component={WordleScreen}
            options={eventScreenOptions('Wordle Jubileo')}
          />
        </>
      )}
    </>
  );
}

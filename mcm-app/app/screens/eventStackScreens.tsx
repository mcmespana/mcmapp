import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import GlassHeader from '@/components/ui/GlassHeader.ios';
import GlassBackButton from '@/components/ui/GlassBackButton';
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

const styles = StyleSheet.create({
  transparentHeader: { backgroundColor: 'transparent' },
});

/**
 * Rutas de sub-pantalla de evento (todo menos el hub `JubileoHome`). Los tabs
 * de evento usan esta lista para decidir cuándo mostrar los FAB glass de
 * acción (`EventActionButtons`) por encima del navigator.
 */
export const EVENT_SUB_ROUTES = [
  'Horario',
  'Materiales',
  'MaterialPages',
  'Visitas',
  'Profundiza',
  'Grupos',
  'Contactos',
  'Apps',
  'Reflexiones',
  'Comida',
  'ComidaWeb',
  'Wordle',
] as const;

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
  (title: string, opts?: { hideHeaderTitle?: boolean }) =>
  ({ route }: { route: EventScreenRoute }) => {
    const event = getEvent(route.params?.eventId);
    const tint = event.tintColor;
    const textColor = getTextColor(tint);
    const isIOS = Platform.OS === 'ios';
    // El tratamiento "flotante" (header transparente + botón Atrás glass) solo
    // se aplica a las pantallas que ya muestran su propio título grande en el
    // contenido (`hideHeaderTitle`). Las que muestran título EN el header
    // (Material, Compartiendo, Comida…) conservan la barra glass tintada para
    // que el texto siga siendo legible — sobre todo en modo oscuro, donde un
    // título oscuro flotando sobre fondo oscuro sería invisible.
    const useFloating = isIOS && !!opts?.hideHeaderTitle;
    return {
      title,
      ...(opts?.hideHeaderTitle ? { headerTitle: () => null } : {}),
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
        isIOS ? (
          useFloating ? (
            // Fondo transparente: solo deja flotar el botón Atrás sobre el
            // contenido. La identidad de color la aporta ya el contenido.
            <View style={[StyleSheet.absoluteFill, styles.transparentHeader]} />
          ) : (
            <GlassHeader tintColor={tint} />
          )
        ) : undefined,
      ...(useFloating ? { headerLeft: () => <GlassBackButton /> } : {}),
    };
  };

/**
 * Opciones del hub del evento (EventHomeScreen). Oculta el título del header
 * (el hero del contenido ya lo muestra) y deja headerRight vacío.
 *
 * El header solo se muestra cuando hay sitio al que volver (`canGoBack`): en la
 * tab propia del evento el hub es la raíz (sin back) → header oculto, y el hero
 * arranca desde el safe-area sin huecos. Desde "Más" (Jubileo) el hub está
 * apilado sobre MasHome → header visible con el botón Atrás flotante.
 */
export const eventHubScreenOptions = ({
  route,
  navigation,
}: {
  route: EventScreenRoute;
  navigation: { canGoBack: () => boolean };
}) => {
  const event = getEvent(route.params?.eventId);
  const canGoBack = navigation.canGoBack();
  return {
    ...eventScreenOptions(event.title, { hideHeaderTitle: true })({ route }),
    headerShown: canGoBack,
    headerRight: undefined,
  };
};

/**
 * Builder del `screenOptions` del Stack.Navigator de un evento. Replica el
 * header gris por defecto (que cada pantalla sobreescribe con su tint vía
 * `eventScreenOptions`).
 *
 * Las acciones de evento (ajustes + Compartiendo) ya no viven en el header:
 * se muestran como FAB glass flotantes (`EventActionButtons`) que el tab
 * renderiza por encima del navigator.
 *
 * @param onNavReady   recibe el `navigation` del stack activo (para popToTop).
 */
export function eventStackScreenOptions({
  webStatusBarHeight,
  onNavReady,
}: {
  webStatusBarHeight?: number;
  onNavReady?: (navigation: any) => void;
}) {
  return ({ navigation }: { navigation: any; route: any }) => {
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
        options={eventScreenOptions('Horario', { hideHeaderTitle: true })}
      />
      <Stack.Screen
        name="Materiales"
        component={MaterialesScreen}
        options={eventScreenOptions('Materiales', { hideHeaderTitle: true })}
      />
      <Stack.Screen
        name="MaterialPages"
        component={MaterialPagesScreen}
        options={eventScreenOptions('Material')}
      />
      <Stack.Screen
        name="Visitas"
        component={VisitasScreen}
        options={eventScreenOptions('Visitas', { hideHeaderTitle: true })}
      />
      <Stack.Screen
        name="Profundiza"
        component={ProfundizaScreen}
        options={eventScreenOptions('Profundiza', { hideHeaderTitle: true })}
      />
      <Stack.Screen
        name="Grupos"
        component={GruposScreen}
        options={eventScreenOptions('Grupos', { hideHeaderTitle: true })}
      />
      <Stack.Screen
        name="Contactos"
        component={ContactosScreen}
        options={eventScreenOptions('Contactos', { hideHeaderTitle: true })}
      />
      <Stack.Screen
        name="Apps"
        component={AppsScreen}
        options={eventScreenOptions('Apps', { hideHeaderTitle: true })}
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

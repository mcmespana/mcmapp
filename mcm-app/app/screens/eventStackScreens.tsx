import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import GlassHeader from '@/components/ui/GlassHeader.ios';
import GlassBackButton from '@/components/ui/GlassBackButton';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';
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
import EvaluacionScreen from './EvaluacionScreen';
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

/**
 * Fondo del header flotante: una capa OPACA pintada con el color de fondo de la
 * pantalla (reactivo al tema claro/oscuro). Sustituye al material translúcido
 * nativo, que dejaba ver un gris por detrás de la barra y creaba el efecto de
 * "doble cristal" con el botón Atrás. Al fundirse con el contenido, la barra
 * resulta visualmente inexistente y el botón "Atrás" glass flota sobre un fondo
 * plano y limpio.
 */
function FloatingHeaderBackground() {
  const scheme = useColorScheme();
  const bg = Colors[scheme ?? 'light'].background;
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} />;
}

/**
 * Título grande del header en WEB para las sub-pantallas de evento. En web el
 * título vive en el propio header (no en un hero in-content), alineado a la
 * izquierda junto al botón "Atrás" — coherente en Horario, Materiales, Visitas,
 * Profundiza, Grupos, Contactos, Apps…
 */
function WebHeaderTitle({ title }: { title: string }) {
  const scheme = useColorScheme();
  const color = Colors[scheme ?? 'light'].text;
  return (
    <Text
      numberOfLines={1}
      style={{
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: -0.4,
        color,
      }}
    >
      {title}
    </Text>
  );
}

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
  Reflexiones: (EventRouteParams & { openFormNonce?: number }) | undefined;
  Evaluacion: EventRouteParams | undefined;
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
  (
    title: string,
    opts?: { hideHeaderTitle?: boolean; webHeaderTitle?: boolean },
  ) =>
  ({ route }: { route: EventScreenRoute }) => {
    const event = getEvent(route.params?.eventId);
    const tint = event.tintColor;
    const textColor = getTextColor(tint);
    const isIOS = Platform.OS === 'ios';
    // "Flotante" = sin header visible: la barra se pinta con el color de fondo
    // de la pantalla (se funde con el contenido, no es el material gris
    // translúcido nativo), sin título (lo pone el ScreenHero del contenido) +
    // botón "Atrás" glass flotante a la izquierda. Las acciones glass van arriba
    // a la derecha vía `EventActionButtons`. Se aplica a todas las sub-pantallas
    // con título grande propio (`hideHeaderTitle`) en TODAS las plataformas.
    const useFloating = !!opts?.hideHeaderTitle;
    if (useFloating) {
      const isWeb = Platform.OS === 'web';
      // En WEB, las sub-pantallas con `webHeaderTitle` muestran su título en el
      // propio header (alineado a la izquierda) y ocultan el hero in-content
      // (`hideOnWeb`), para que el contenido quede pegado al header. El hub y
      // pantallas con sub-navegación propia (Compartiendo) NO lo activan, para
      // no duplicar el título. En iOS/Android el título siempre lo pone el hero
      // del contenido, así que el header va sin título (`() => <View />` — un
      // `() => null` no basta: native-stack reaparece el `title`).
      const showWebTitle = isWeb && !!opts?.webHeaderTitle;
      return {
        title,
        headerTitle: showWebTitle
          ? () => <WebHeaderTitle title={title} />
          : () => <View />,
        ...(showWebTitle ? { headerTitleAlign: 'left' as const } : {}),
        // En web separamos el botón "Atrás" del borde izquierdo en todas las
        // sub-pantallas (mejora inofensiva y coherente).
        ...(isWeb
          ? { headerLeftContainerStyle: { paddingLeft: spacing.md } }
          : {}),
        headerStyle: { backgroundColor: 'transparent' },
        headerShadowVisible: false,
        headerBackground: () => <FloatingHeaderBackground />,
        // En iOS/Android usamos el back NATIVO (icono solo) — iOS 26 ya le pone
        // su cápsula liquid-glass. El GlassBackButton custom se "envolvía dos
        // veces" (cápsula dentro de cápsula). En web mantenemos el custom.
        ...(isWeb
          ? { headerLeft: () => <GlassBackButton /> }
          : { headerBackButtonDisplayMode: 'minimal' as const }),
      };
    }
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
        isIOS ? <GlassHeader tintColor={tint} /> : undefined,
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
  navigation: { getState?: () => { index?: number } | undefined };
}) => {
  const event = getEvent(route.params?.eventId);
  // El hub solo muestra header cuando está apilado sobre otra pantalla (índice
  // > 0 en su stack, p.ej. abierto desde "Más"). En la tab propia del evento es
  // la raíz del stack → sin header, y el hero arranca desde el safe-area sin
  // huecos. `canGoBack()` no sirve aquí porque sube a los navigators padre.
  const idx = navigation.getState?.()?.index ?? 0;
  const isPushed = idx > 0;
  return {
    ...eventScreenOptions(event.title, { hideHeaderTitle: true })({ route }),
    headerShown: isPushed,
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
  isDark = false,
}: {
  webStatusBarHeight?: number;
  onNavReady?: (navigation: any) => void;
  isDark?: boolean;
}) {
  // En iOS el header es glass (se adapta al tema): en oscuro el texto debe ser
  // CLARO o no se lee (antes estaba fijo en #1a1a1a → invisible en modo oscuro).
  const iosHeaderText = isDark ? '#FFFFFF' : '#1a1a1a';
  return ({ navigation }: { navigation: any; route: any }) => {
    onNavReady?.(navigation);
    return {
      freezeOnBlur: true,
      // Back solo con icono (sin la palabra "Atrás" al lado).
      headerBackButtonDisplayMode: 'minimal' as const,
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
      headerTintColor: Platform.OS === 'ios' ? iosHeaderText : '#fff',
      headerShadowVisible: false,
      headerTitleStyle: {
        fontWeight: '700' as const,
        fontSize: 18,
        color: Platform.OS === 'ios' ? iosHeaderText : '#fff',
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
        options={eventScreenOptions('Horario', {
          hideHeaderTitle: true,
          webHeaderTitle: true,
        })}
      />
      <Stack.Screen
        name="Materiales"
        component={MaterialesScreen}
        options={eventScreenOptions('Materiales', {
          hideHeaderTitle: true,
          webHeaderTitle: true,
        })}
      />
      <Stack.Screen
        name="MaterialPages"
        component={MaterialPagesScreen}
        options={eventScreenOptions('Material')}
      />
      <Stack.Screen
        name="Visitas"
        component={VisitasScreen}
        options={eventScreenOptions('Visitas', {
          hideHeaderTitle: true,
          webHeaderTitle: true,
        })}
      />
      <Stack.Screen
        name="Profundiza"
        component={ProfundizaScreen}
        options={eventScreenOptions('Profundiza', {
          hideHeaderTitle: true,
          webHeaderTitle: true,
        })}
      />
      <Stack.Screen
        name="Grupos"
        component={GruposScreen}
        options={eventScreenOptions('Grupos', {
          hideHeaderTitle: true,
          webHeaderTitle: true,
        })}
      />
      <Stack.Screen
        name="Contactos"
        component={ContactosScreen}
        options={eventScreenOptions('Contactos', {
          hideHeaderTitle: true,
          webHeaderTitle: true,
        })}
      />
      <Stack.Screen
        name="Apps"
        component={AppsScreen}
        options={eventScreenOptions('Apps', {
          hideHeaderTitle: true,
          webHeaderTitle: true,
        })}
      />
      <Stack.Screen
        name="Reflexiones"
        component={ReflexionesScreen}
        options={eventScreenOptions('Compartiendo', { hideHeaderTitle: true })}
      />
      <Stack.Screen
        name="Evaluacion"
        component={EvaluacionScreen}
        options={{ headerShown: false }}
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

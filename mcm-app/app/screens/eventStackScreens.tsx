import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';

import GlassHeader from '@/components/ui/GlassHeader.ios';
import GlassBackButton from '@/components/ui/GlassBackButton';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors, themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import { getEvent } from '@/constants/events';
import { onColor } from '@/utils/colorUtils';
import { EVENT_SLUGS } from '@/utils/eventRoutes';

/**
 * Plumbing compartido del stack de un evento (Jubileo, Visita Papa, etc.).
 *
 * Las sub-pantallas de evento son las mismas en todos los eventos; este módulo
 * declara una sola vez sus opciones de header para que las consuman tanto el
 * tab "Más" (`app/(tabs)/mas/_layout.tsx`) como las tabs de evento propias
 * (ej. `app/(tabs)/visitapapa/_layout.tsx`). Cada pantalla es un FICHERO de
 * ruta en cada una de esas carpetas (un `export { default } from …` de una
 * línea): expo-router 58 ya no admite montar un navegador a mano. Las rutas y
 * cómo se llega a ellas por nombre: `utils/eventRoutes.ts`.
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

/** Pantallas del stack de «Más» (las de evento van en `EventStackParamList`). */
export type MasStackParamList = EventStackParamList & {
  MasHome: { directTo?: string } | undefined;
  Fotos: undefined;
  Calendario: undefined;
  Comunica: undefined;
  ComunicaGestion: undefined;
  McmPanel: undefined;
  EventosPasados: undefined;
};

type EventScreenRoute = { params?: { eventId?: string } };

/** Lo que React Navigation pasa a un `options` en forma de función. */
type EventScreenOptionsArgs = {
  route: EventScreenRoute;
  theme?: { dark: boolean };
};

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
// rompía la coherencia visual con el resto de la app.
// Android pinta la barra ENTERA del color del evento, así que el texto se
// decide por contraste con ese color (`onColor`, design.md §5). Antes era
// blanco siempre: 2,13:1 sobre el verde del Jubileo y 1,46:1 sobre el
// amarillo de Visita Papa, ilegible.
export const getTextColor = (tintColor?: string) => {
  if (Platform.OS === 'android') return tintColor ? onColor(tintColor) : '#fff';
  return '#1a1a1a';
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
  ({ route, theme }: EventScreenOptionsArgs) => {
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
        // En iOS: header TRANSPARENTE con glass del sistema (como el cantoral).
        // Los hero que van FUERA del scroll usan `floatingHeaderInset` en su
        // ScreenHero para reservar la altura; los que van dentro del scroll
        // auto-insetan solos. En Android/web, fondo opaco que reserva espacio.
        ...(Platform.OS === 'ios'
          ? {
              headerTransparent: true,
              ...(parseInt(String(Platform.Version), 10) < 26
                ? { headerBlurEffect: 'systemChromeMaterial' as const }
                : {}),
            }
          : { headerBackground: () => <FloatingHeaderBackground /> }),
        // En Android la flecha nativa hereda el `headerTintColor` blanco del
        // navegador (pensado para la barra gris), y aquí el fondo es el de la
        // pantalla: en claro era blanco sobre blanco, invisible. Va con el rol
        // del tema, como el texto del header en iOS.
        ...(Platform.OS === 'android'
          ? { headerTintColor: themeColors(!!theme?.dark).headerTint }
          : {}),
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
  theme,
}: EventScreenOptionsArgs & {
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
    ...eventScreenOptions(event.title, { hideHeaderTitle: true })({
      route,
      theme,
    }),
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
  const iosHeaderText = themeColors(!!isDark).headerTint;
  return ({ navigation }: { navigation: any; route: any }) => {
    onNavReady?.(navigation);
    return {
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
      // Header TRANSPARENTE en iOS (como el cantoral): transparente arriba y
      // glass del sistema al hacer scroll, en vez de la barra gris opaca.
      headerTransparent: Platform.OS === 'ios',
      ...(Platform.OS === 'ios' && parseInt(String(Platform.Version), 10) < 26
        ? { headerBlurEffect: 'systemChromeMaterial' as const }
        : {}),
    };
  };
}

/**
 * Declara las sub-pantallas de un evento dentro del `<Stack>` de un layout. El
 * `name` de cada una es su ruta (`horario`, `material`…): tiene que existir el
 * fichero en esa carpeta (`utils/eventRoutes.ts` lista los trozos).
 *
 * Devuelve un ARRAY de `Stack.Screen`, no un fragmento ni un componente: el
 * `Stack` de expo-router 58 recorre sus hijos con `Children.toArray`, que
 * aplana arrays pero NO fragmentos (un `<>…</>` da «Unknown child element
 * passed to Stack» y revienta al avisar). Lo cubre `tabsMountWithRouter`.
 *
 * @param opts.includeHub     declara el hub como `evento` (el de «Más»). La
 *                            pestaña propia del evento declara su `index`.
 * @param opts.includeExtras  declara Comida/ComidaWeb/Wordle (solo Jubileo;
 *                            Visita Papa usa una sección-enlace para la comida).
 */
export function renderEventScreens(opts?: {
  includeHub?: boolean;
  includeExtras?: boolean;
}) {
  const { includeHub = false, includeExtras = false } = opts ?? {};
  const full = { hideHeaderTitle: true, webHeaderTitle: true };
  const screens: { name: string; options: unknown }[] = [
    ...(includeHub ? [{ name: 'evento', options: eventHubScreenOptions }] : []),
    {
      name: EVENT_SLUGS.Horario,
      options: eventScreenOptions('Horario', full),
    },
    {
      name: EVENT_SLUGS.Materiales,
      options: eventScreenOptions('Materiales', full),
    },
    {
      name: EVENT_SLUGS.MaterialPages,
      options: eventScreenOptions('Material'),
    },
    {
      name: EVENT_SLUGS.Visitas,
      options: eventScreenOptions('Visitas', full),
    },
    {
      name: EVENT_SLUGS.Profundiza,
      options: eventScreenOptions('Profundiza', full),
    },
    { name: EVENT_SLUGS.Grupos, options: eventScreenOptions('Grupos', full) },
    {
      name: EVENT_SLUGS.Contactos,
      options: eventScreenOptions('Contactos', full),
    },
    { name: EVENT_SLUGS.Apps, options: eventScreenOptions('Apps', full) },
    {
      name: EVENT_SLUGS.Reflexiones,
      options: eventScreenOptions('Compartiendo', { hideHeaderTitle: true }),
    },
    { name: EVENT_SLUGS.Evaluacion, options: { headerShown: false } },
    ...(includeExtras
      ? [
          { name: EVENT_SLUGS.Comida, options: eventScreenOptions('Comida') },
          {
            name: EVENT_SLUGS.ComidaWeb,
            options: eventScreenOptions('Comida'),
          },
          {
            name: EVENT_SLUGS.Wordle,
            options: eventScreenOptions('Wordle Jubileo'),
          },
        ]
      : []),
  ];
  return screens.map(({ name, options }) => (
    <Stack.Screen key={name} name={name} options={options as never} />
  ));
}

import React, { useState, useRef, useEffect } from 'react';
import { View, Platform } from 'react-native';
import { useNavigation } from 'expo-router';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { MaterialIcons } from '@expo/vector-icons';
import { PressableFeedback } from 'heroui-native';
import GlassHeader from '@/components/ui/GlassHeader.ios';

import MasHomeScreen from '../screens/MasHomeScreen';
import ComunicaScreen from '../screens/ComunicaScreen';
import ComunicaGestionScreen from '../screens/ComunicaGestionScreen';
import EventHomeScreen from '../screens/EventHomeScreen';
import HorarioScreen from '../screens/HorarioScreen';
import MaterialesScreen from '../screens/MaterialesScreen';
import MaterialPagesScreen from '../screens/MaterialPagesScreen';
import VisitasScreen from '../screens/VisitasScreen';
import ProfundizaScreen from '../screens/ProfundizaScreen';
import GruposScreen from '../screens/GruposScreen';
import ContactosScreen from '../screens/ContactosScreen';
import ReflexionesScreen from '../screens/ReflexionesScreen';
import AppsScreen from '../screens/AppsScreen';
import WordleScreen from '../screens/WordleScreen';
import ComidaScreen from '../screens/ComidaScreen';
import ComidaWebScreen from '../screens/ComidaWebScreen';
import SettingsPanel from '@/components/SettingsPanel';
import { getEvent } from '@/constants/events';

/**
 * Route params comunes a todas las pantallas de un evento (Jubileo u otros
 * eventos futuros). El `eventId` se resuelve en `constants/events.ts` para
 * saber de qué path de Firebase leer y qué colores usar en el header.
 * Si no se pasa, se usa el evento por defecto.
 */
type EventRouteParams = { eventId?: string };

export type MasStackParamList = {
  MasHome: { directTo?: string } | undefined;
  Comunica: undefined;
  ComunicaGestion: undefined;
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

const Stack = createNativeStackNavigator<MasStackParamList>();

// Helper para obtener estilos del header según la plataforma.
// Web sigue el mismo patrón ligero que el cantoral: fondo tintado + hairline,
// sin sombra pesada — así los headers se sienten coherentes en toda la app.
const getHeaderStyle = (tintColor: string) => {
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

// Helper para obtener el color del texto según el color de fondo
const getTextColor = (tintColor: string) => {
  // Determinar si el color es claro u oscuro
  const hex = tintColor.replace('#', '');
  const r = parseInt(
    hex.length === 6 ? hex.substring(0, 2) : hex[0] + hex[0],
    16,
  );
  const g = parseInt(
    hex.length === 6 ? hex.substring(2, 4) : hex[1] + hex[1],
    16,
  );
  const b = parseInt(
    hex.length === 6 ? hex.substring(4, 6) : hex[2] + hex[2],
    16,
  );
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  if (Platform.OS === 'ios') {
    return '#1a1a1a'; // iOS siempre usa texto oscuro con GlassHeader
  } else if (Platform.OS === 'web') {
    return brightness > 180 ? '#1a1a1a' : '#fff'; // Texto oscuro para colores claros, blanco para oscuros
  } else {
    return '#fff'; // Android usa texto blanco por defecto
  }
};

/**
 * Opciones de header para una pantalla de evento. El color se deriva del
 * `eventId` del route param — cae a Jubileo si falta. Esto permite reusar
 * todas las sub-pantallas para eventos nuevos sin duplicar registros.
 */
type EventScreenRoute = { params?: { eventId?: string } };

const eventScreenOptions =
  (title: string) =>
  ({ route }: { route: EventScreenRoute }) => {
    const event = getEvent(route.params?.eventId);
    const tint = event.tintColor;
    const textColor = getTextColor(tint);
    return {
      title,
      headerStyle: getHeaderStyle(tint),
      headerTintColor: textColor,
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
const eventHubScreenOptions = ({ route }: { route: EventScreenRoute }) => {
  const event = getEvent(route.params?.eventId);
  return {
    ...eventScreenOptions(event.title)({ route }),
    headerRight: undefined,
  };
};

export default function MasTab() {
  const [settingsVisible, setSettingsVisible] = useState(false);
  const stackNavRef = useRef<any>(null);

  const navigation = useNavigation();

  useEffect(() => {
    const unsubscribe = navigation
      .getParent()
      ?.addListener('tabPress' as any, (e: any) => {
        if (stackNavRef.current?.canGoBack()) {
          e.preventDefault?.();
          stackNavRef.current.popToTop();
        }
      });

    return unsubscribe;
  }, [navigation]);

  return (
    <>
      <SettingsPanel
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
      <Stack.Navigator
        initialRouteName="MasHome"
        screenOptions={({ navigation, route }) => {
          // Capture stack navigation ref for tab press handling
          stackNavRef.current = navigation;
          return {
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
            headerTintColor:
              Platform.OS === 'ios'
                ? '#1a1a1a'
                : Platform.OS === 'web'
                  ? '#fff'
                  : '#fff',
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 18,
              color:
                Platform.OS === 'ios'
                  ? '#1a1a1a'
                  : Platform.OS === 'web'
                    ? '#fff'
                    : '#fff',
            },
            headerTitleAlign: 'center',
            headerStatusBarHeight: Platform.OS === 'web' ? 0 : undefined,
            headerTransparent: false,
            headerBackground: () =>
              Platform.OS === 'ios' ? (
                <GlassHeader tintColor="#78909C" />
              ) : undefined,
            headerRight: () => {
              // Solo mostrar los botones en las pantallas de un evento
              const isEventScreen =
                route.name !== 'MasHome' && route.name !== 'JubileoHome';
              if (!isEventScreen) return null;

              // Color del icono según el evento activo (cae a Jubileo)
              const eventId = (route.params as { eventId?: string } | undefined)
                ?.eventId;
              const iconColor = getTextColor(getEvent(eventId).tintColor);

              return (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginRight: 8,
                  }}
                >
                  <PressableFeedback
                    onPress={() => setSettingsVisible(true)}
                    style={{ padding: 10 }}
                  >
                    <PressableFeedback.Highlight />
                    <MaterialIcons
                      name="settings"
                      size={26}
                      color={iconColor}
                    />
                  </PressableFeedback>
                  {route.name !== 'Reflexiones' && (
                    <PressableFeedback
                      onPress={() =>
                        navigation.navigate('Reflexiones', { eventId })
                      }
                      style={{ padding: 10 }}
                    >
                      <PressableFeedback.Highlight />
                      <MaterialIcons name="forum" size={26} color={iconColor} />
                    </PressableFeedback>
                  )}
                </View>
              );
            },
          };
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
          name="JubileoHome"
          component={EventHomeScreen}
          options={eventHubScreenOptions}
        />
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
          name="Wordle"
          component={WordleScreen}
          options={eventScreenOptions('Wordle Jubileo')}
        />
        <Stack.Screen
          name="Reflexiones"
          component={ReflexionesScreen}
          options={eventScreenOptions('Compartiendo')}
        />
      </Stack.Navigator>
    </>
  );
}

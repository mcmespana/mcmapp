import React, { useState } from 'react';
import { View, Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import GlassHeader from '@/components/ui/GlassHeader.ios';

import MasHomeScreen from '../screens/MasHomeScreen';
import MonitoresWebScreen from '../screens/MonitoresWebScreen';
import JubileoHomeScreen from '../screens/JubileoHomeScreen';
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

export type MasStackParamList = {
  MasHome: undefined;
  MonitoresWeb: undefined;
  JubileoHome: undefined;
  Horario: undefined;
  Materiales: { initialDayIndex?: number } | undefined;
  MaterialPages: { actividad: any; fecha: string };
  Visitas: undefined;
  Comida: undefined;
  ComidaWeb: { url: string; title: string };
  Profundiza: undefined;
  Grupos: undefined;
  Contactos: undefined;
  Apps: undefined;
  Wordle: undefined;
  Reflexiones: undefined;
};

const Stack = createNativeStackNavigator<MasStackParamList>();

// Helper para obtener estilos del header según la plataforma
const getHeaderStyle = (tintColor: string) => {
  if (Platform.OS === 'ios') {
    return { backgroundColor: 'transparent' };
  } else if (Platform.OS === 'web') {
    return {
      backgroundColor: tintColor,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0, 0, 0, 0.1)',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    };
  } else {
    return { backgroundColor: tintColor };
  }
};

// Helper para obtener el color del texto según el color de fondo
const getTextColor = (tintColor: string) => {
  // Determinar si el color es claro u oscuro
  const hex = tintColor.replace('#', '');
  const r = parseInt(hex.length === 6 ? hex.substring(0, 2) : hex[0] + hex[0], 16);
  const g = parseInt(hex.length === 6 ? hex.substring(2, 4) : hex[1] + hex[1], 16);
  const b = parseInt(hex.length === 6 ? hex.substring(4, 6) : hex[2] + hex[2], 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  if (Platform.OS === 'ios') {
    return '#1a1a1a'; // iOS siempre usa texto oscuro con GlassHeader
  } else if (Platform.OS === 'web') {
    return brightness > 180 ? '#1a1a1a' : '#fff'; // Texto oscuro para colores claros, blanco para oscuros
  } else {
    return '#fff'; // Android usa texto blanco por defecto
  }
};

export default function MasTab() {
  const [settingsVisible, setSettingsVisible] = useState(false);

  return (
    <>
      <SettingsPanel
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
      <Stack.Navigator
        initialRouteName="MasHome"
        screenOptions={({ navigation, route }) => ({
          headerBackTitle: 'Atrás',
          headerStyle: Platform.OS === 'ios' 
            ? { backgroundColor: 'transparent' }
            : Platform.OS === 'web'
            ? {
                backgroundColor: '#78909C',
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(0, 0, 0, 0.1)',
                elevation: 2,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
              }
            : { backgroundColor: '#78909C' },
          headerTintColor: Platform.OS === 'ios' ? '#1a1a1a' : Platform.OS === 'web' ? '#fff' : '#fff',
          headerTitleStyle: { 
            fontWeight: '700', 
            fontSize: 18,
            color: Platform.OS === 'ios' ? '#1a1a1a' : Platform.OS === 'web' ? '#fff' : '#fff',
          },
          headerTitleAlign: 'center',
          headerStatusBarHeight: Platform.OS === 'web' ? 0 : undefined,
          headerTransparent: false,
          headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#78909C" /> : undefined,
          headerRight: () => {
            // Solo mostrar los botones en las pantallas de Jubileo
            const isJubileoScreen = route.name !== 'MasHome' && route.name !== 'JubileoHome';
            if (!isJubileoScreen) return null;

            // Para las pantallas de Jubileo, usar el color del texto del Jubileo (#A3BD31)
            const iconColor = getTextColor('#A3BD31');

            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
                <TouchableOpacity
                  onPress={() => setSettingsVisible(true)}
                  style={{ padding: 10 }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons name="settings" size={26} color={iconColor} />
                </TouchableOpacity>
                {route.name !== 'Reflexiones' && (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Reflexiones')}
                    style={{ padding: 10 }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <MaterialIcons name="forum" size={26} color={iconColor} />
                  </TouchableOpacity>
                )}
              </View>
            );
          },
        })}
      >
        <Stack.Screen
          name="MasHome"
          component={MasHomeScreen}
          options={{
            title: 'Más',
            headerRight: undefined, // No mostrar botones en la pantalla principal
          }}
        />
        <Stack.Screen
          name="MonitoresWeb"
          component={MonitoresWebScreen}
          options={{
            headerShown: false, // Sin header para ganar espacio - volver con tab "Más"
          }}
        />
        <Stack.Screen
          name="JubileoHome"
          component={JubileoHomeScreen}
          options={{
            title: 'Jubileo',
            headerStyle: getHeaderStyle('#A3BD31'),
            headerTintColor: getTextColor('#A3BD31'),
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 18,
              color: getTextColor('#A3BD31'),
            },
            headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#A3BD31" /> : undefined,
            headerRight: undefined, // No mostrar botones en la home del jubileo
          }}
        />
        <Stack.Screen
          name="Horario"
          component={HorarioScreen}
          options={{
            title: 'Horario',
            headerStyle: getHeaderStyle('#A3BD31'),
            headerTintColor: getTextColor('#A3BD31'),
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 18,
              color: getTextColor('#A3BD31'),
            },
            headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#A3BD31" /> : undefined,
          }}
        />
        <Stack.Screen
          name="Materiales"
          component={MaterialesScreen}
          options={{
            title: 'Materiales',
            headerStyle: getHeaderStyle('#A3BD31'),
            headerTintColor: getTextColor('#A3BD31'),
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 18,
              color: getTextColor('#A3BD31'),
            },
            headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#A3BD31" /> : undefined,
          }}
        />
        <Stack.Screen
          name="MaterialPages"
          component={MaterialPagesScreen}
          options={{
            title: 'Material',
            headerStyle: getHeaderStyle('#A3BD31'),
            headerTintColor: getTextColor('#A3BD31'),
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 18,
              color: getTextColor('#A3BD31'),
            },
            headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#A3BD31" /> : undefined,
          }}
        />
        <Stack.Screen
          name="Comida"
          component={ComidaScreen}
          options={{
            title: 'Comida',
            headerStyle: getHeaderStyle('#A3BD31'),
            headerTintColor: getTextColor('#A3BD31'),
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 18,
              color: getTextColor('#A3BD31'),
            },
            headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#A3BD31" /> : undefined,
          }}
        />
        <Stack.Screen
          name="ComidaWeb"
          component={ComidaWebScreen}
          options={{
            title: 'Comida',
            headerStyle: getHeaderStyle('#A3BD31'),
            headerTintColor: getTextColor('#A3BD31'),
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 18,
              color: getTextColor('#A3BD31'),
            },
            headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#A3BD31" /> : undefined,
          }}
        />
        <Stack.Screen
          name="Visitas"
          component={VisitasScreen}
          options={{
            title: 'Visitas',
            headerStyle: getHeaderStyle('#A3BD31'),
            headerTintColor: getTextColor('#A3BD31'),
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 18,
              color: getTextColor('#A3BD31'),
            },
            headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#A3BD31" /> : undefined,
          }}
        />
        <Stack.Screen
          name="Profundiza"
          component={ProfundizaScreen}
          options={{
            title: 'Profundiza',
            headerStyle: getHeaderStyle('#A3BD31'),
            headerTintColor: getTextColor('#A3BD31'),
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 18,
              color: getTextColor('#A3BD31'),
            },
            headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#A3BD31" /> : undefined,
          }}
        />
        <Stack.Screen
          name="Grupos"
          component={GruposScreen}
          options={{
            title: 'Grupos',
            headerStyle: getHeaderStyle('#A3BD31'),
            headerTintColor: getTextColor('#A3BD31'),
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 18,
              color: getTextColor('#A3BD31'),
            },
            headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#A3BD31" /> : undefined,
          }}
        />
        <Stack.Screen
          name="Contactos"
          component={ContactosScreen}
          options={{
            title: 'Contactos',
            headerStyle: getHeaderStyle('#A3BD31'),
            headerTintColor: getTextColor('#A3BD31'),
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 18,
              color: getTextColor('#A3BD31'),
            },
            headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#A3BD31" /> : undefined,
          }}
        />
        <Stack.Screen
          name="Apps"
          component={AppsScreen}
          options={{
            title: 'Apps',
            headerStyle: getHeaderStyle('#A3BD31'),
            headerTintColor: getTextColor('#A3BD31'),
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 18,
              color: getTextColor('#A3BD31'),
            },
            headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#A3BD31" /> : undefined,
          }}
        />
        <Stack.Screen
          name="Wordle"
          component={WordleScreen}
          options={{
            title: 'Wordle Jubileo',
            headerStyle: getHeaderStyle('#A3BD31'),
            headerTintColor: getTextColor('#A3BD31'),
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 18,
              color: getTextColor('#A3BD31'),
            },
            headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#A3BD31" /> : undefined,
          }}
        />
        <Stack.Screen
          name="Reflexiones"
          component={ReflexionesScreen}
          options={{
            title: 'Compartiendo',
            headerStyle: getHeaderStyle('#A3BD31'),
            headerTintColor: getTextColor('#A3BD31'),
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 18,
              color: getTextColor('#A3BD31'),
            },
            headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#A3BD31" /> : undefined,
          }}
        />
      </Stack.Navigator>
    </>
  );
}

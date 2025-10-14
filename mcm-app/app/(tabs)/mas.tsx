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
          headerStyle: { backgroundColor: '#78909C' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold', fontSize: 18 },
          headerTitleAlign: 'center',
          headerStatusBarHeight: Platform.OS === 'web' ? 0 : undefined,
          headerTransparent: Platform.OS === 'ios',
          headerBlurEffect: Platform.OS === 'ios' ? 'systemChromeMaterial' : undefined,
          headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#78909C" /> : undefined,
          headerRight: () => {
            // Solo mostrar los botones en las pantallas de Jubileo
            const isJubileoScreen = route.name !== 'MasHome' && route.name !== 'JubileoHome';
            if (!isJubileoScreen) return null;

            return (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity
                  onPress={() => setSettingsVisible(true)}
                  style={{ padding: 8, marginRight: 4 }}
                >
                  <MaterialIcons name="settings" size={24} color="#fff" />
                </TouchableOpacity>
                {route.name !== 'Reflexiones' && (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Reflexiones')}
                    style={{ padding: 8 }}
                  >
                    <MaterialIcons name="forum" size={24} color="#fff" />
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
            title: 'Comunica MCM · Monitores',
            headerStyle: { backgroundColor: '#607D8B' },
            headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#607D8B" /> : undefined,
            headerRight: undefined,
          }}
        />
        <Stack.Screen
          name="JubileoHome"
          component={JubileoHomeScreen}
          options={{
            title: 'Jubileo',
            headerStyle: { backgroundColor: '#A3BD31' },
            headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#A3BD31" /> : undefined,
            headerRight: undefined, // No mostrar botones en la home del jubileo
          }}
        />
        <Stack.Screen
          name="Horario"
          component={HorarioScreen}
          options={{
            title: 'Horario',
            headerStyle: { backgroundColor: '#A3BD31' },
            headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#A3BD31" /> : undefined,
          }}
        />
        <Stack.Screen
          name="Materiales"
          component={MaterialesScreen}
          options={{
            title: 'Materiales',
            headerStyle: { backgroundColor: '#A3BD31' },
            headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#A3BD31" /> : undefined,
          }}
        />
        <Stack.Screen
          name="MaterialPages"
          component={MaterialPagesScreen}
          options={{
            title: 'Material',
            headerStyle: { backgroundColor: '#A3BD31' },
            headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#A3BD31" /> : undefined,
          }}
        />
        <Stack.Screen
          name="Comida"
          component={ComidaScreen}
          options={{
            title: 'Comida',
            headerStyle: { backgroundColor: '#A3BD31' },
            headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#A3BD31" /> : undefined,
          }}
        />
        <Stack.Screen
          name="ComidaWeb"
          component={ComidaWebScreen}
          options={{
            title: 'Comida',
            headerStyle: { backgroundColor: '#A3BD31' },
            headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#A3BD31" /> : undefined,
          }}
        />
        <Stack.Screen
          name="Visitas"
          component={VisitasScreen}
          options={{
            title: 'Visitas',
            headerStyle: { backgroundColor: '#A3BD31' },
            headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#A3BD31" /> : undefined,
          }}
        />
        <Stack.Screen
          name="Profundiza"
          component={ProfundizaScreen}
          options={{
            title: 'Profundiza',
            headerStyle: { backgroundColor: '#A3BD31' },
            headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#A3BD31" /> : undefined,
          }}
        />
        <Stack.Screen
          name="Grupos"
          component={GruposScreen}
          options={{
            title: 'Grupos',
            headerStyle: { backgroundColor: '#A3BD31' },
            headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#A3BD31" /> : undefined,
          }}
        />
        <Stack.Screen
          name="Contactos"
          component={ContactosScreen}
          options={{
            title: 'Contactos',
            headerStyle: { backgroundColor: '#A3BD31' },
            headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#A3BD31" /> : undefined,
          }}
        />
        <Stack.Screen
          name="Apps"
          component={AppsScreen}
          options={{
            title: 'Apps',
            headerStyle: { backgroundColor: '#A3BD31' },
            headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#A3BD31" /> : undefined,
          }}
        />
        <Stack.Screen
          name="Wordle"
          component={WordleScreen}
          options={{
            title: 'Wordle Jubileo',
            headerStyle: { backgroundColor: '#A3BD31' },
            headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#A3BD31" /> : undefined,
          }}
        />
        <Stack.Screen
          name="Reflexiones"
          component={ReflexionesScreen}
          options={{
            title: 'Compartiendo',
            headerStyle: { backgroundColor: '#A3BD31' },
            headerBackground: () => Platform.OS === 'ios' ? <GlassHeader tintColor="#A3BD31" /> : undefined,
          }}
        />
      </Stack.Navigator>
    </>
  );
}

import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';

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
import SettingsPanel from '@/components/SettingsPanel';

export type JubileoStackParamList = {
  Home: undefined;
  Horario: undefined;
  Materiales: undefined;
  MaterialPages: { actividad: any; fecha: string };
  Visitas: undefined;
  Profundiza: undefined;
  Grupos: undefined;
  Contactos: undefined;
  Apps: undefined;
  Reflexiones: undefined;
};

const Stack = createNativeStackNavigator<JubileoStackParamList>();

export default function JubileoTab() {
  const [settingsVisible, setSettingsVisible] = useState(false);
  return (
    <>
      <SettingsPanel
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={({ navigation, route }) => ({
          headerBackTitle: 'Atrás',
          headerStyle: { backgroundColor: '#A3BD31' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
          headerTitleAlign: 'center',
          headerRight: () => (
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
          ),
        })}
      >
        <Stack.Screen
          name="Home"
          component={JubileoHomeScreen}
          options={{ title: 'Jubileo' }}
        />
        <Stack.Screen
          name="Horario"
          component={HorarioScreen}
          options={{ title: 'Horario' }}
        />
        <Stack.Screen
          name="Materiales"
          component={MaterialesScreen}
          options={{ title: 'Materiales' }}
        />
        <Stack.Screen
          name="MaterialPages"
          component={MaterialPagesScreen}
          options={{ title: 'Material' }}
        />
        <Stack.Screen
          name="Visitas"
          component={VisitasScreen}
          options={{ title: 'Visitas' }}
        />
        <Stack.Screen
          name="Profundiza"
          component={ProfundizaScreen}
          options={{ title: 'Profundiza' }}
        />
        <Stack.Screen
          name="Grupos"
          component={GruposScreen}
          options={{ title: 'Grupos' }}
        />
        <Stack.Screen
          name="Contactos"
          component={ContactosScreen}
          options={{ title: 'Contactos' }}
        />
        <Stack.Screen
          name="Apps"
          component={AppsScreen}
          options={{ title: 'Apps' }}
        />
        <Stack.Screen
          name="Reflexiones"
          component={ReflexionesScreen}
          options={{
            title: 'Compartiendo',
            headerStyle: { backgroundColor: '#A3BD31' },
          }}
        />
      </Stack.Navigator>
    </>
  );
}

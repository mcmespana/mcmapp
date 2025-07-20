import React, { useState } from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import JubileoHomeScreen from '../screens/JubileoHomeScreen';
import HorarioScreen from '../screens/HorarioScreen';
import MaterialesScreen from '../screens/MaterialesScreen';
import MaterialPagesScreen from '../screens/MaterialPagesScreen';
import VisitasScreen from '../screens/VisitasScreen';
import ProfundizaScreen from '../screens/ProfundizaScreen';
import GruposScreen from '../screens/GruposScreen';
import ContactosScreen from '../screens/ContactosScreen';
import ReflexionesScreen from '../screens/ReflexionesScreen';
import { IconButton } from 'react-native-paper';
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
  Reflexiones: undefined;
};

const Stack = createNativeStackNavigator<JubileoStackParamList>();

export default function JubileoTab() {
  const [settingsVisible, setSettingsVisible] = useState(false);
  return (
    <>
      <SettingsPanel visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
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
            <IconButton
              icon="settings"
              size={24}
              iconColor="#fff"
              style={{ marginRight: 4 }}
              onPress={() => setSettingsVisible(true)}
            />
            {route.name !== 'Reflexiones' && (
              <IconButton
                icon="forum"
                size={24}
                iconColor="#fff"
                onPress={() => navigation.navigate('Reflexiones')}
              />
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

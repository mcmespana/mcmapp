import { createNativeStackNavigator } from '@react-navigation/native-stack';

import JubileoHomeScreen from '../screens/JubileoHomeScreen';
import HorarioScreen from '../screens/HorarioScreen';
import MaterialesScreen from '../screens/MaterialesScreen';
import VisitasScreen from '../screens/VisitasScreen';
import ProfundizaScreen from '../screens/ProfundizaScreen';
import GruposScreen from '../screens/GruposScreen';

export type JubileoStackParamList = {
  Home: undefined;
  Horario: undefined;
  Materiales: undefined;
  Visitas: undefined;
  Profundiza: undefined;
  Grupos: undefined;
};

const Stack = createNativeStackNavigator<JubileoStackParamList>();

export default function JubileoTab() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerBackTitle: 'Atrás',
        headerStyle: { backgroundColor: '#9D1E74' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        headerTitleAlign: 'center',
      }}
    >
      <Stack.Screen name="Home" component={JubileoHomeScreen} options={{ title: 'Jubileo' }} />
      <Stack.Screen name="Horario" component={HorarioScreen} options={{ title: 'Horario' }} />
      <Stack.Screen name="Materiales" component={MaterialesScreen} options={{ title: 'Materiales' }} />
      <Stack.Screen name="Visitas" component={VisitasScreen} options={{ title: 'Visitas' }} />
      <Stack.Screen name="Profundiza" component={ProfundizaScreen} options={{ title: 'Profundiza' }} />
      <Stack.Screen name="Grupos" component={GruposScreen} options={{ title: 'Grupos' }} />
    </Stack.Navigator>
  );
}

import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, StackActions } from '@react-navigation/native';

import GlassHeader from '@/components/ui/GlassHeader.ios';

import ContigoHomeScreen from '../screens/ContigoHomeScreen';
import EvangelioScreen from '../screens/EvangelioScreen';
import OracionScreen from '../screens/OracionScreen';

export type ContigoStackParamList = {
  ContigoHome: undefined;
  Evangelio: undefined;
  Oracion: undefined;
};

const Stack = createNativeStackNavigator<ContigoStackParamList>();

const TINT = '#E15C62';

const getHeaderStyle = () => {
  if (Platform.OS === 'ios') return { backgroundColor: 'transparent' };
  if (Platform.OS === 'web')
    return {
      backgroundColor: TINT,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0, 0, 0, 0.1)',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    };
  return { backgroundColor: TINT };
};

const getTextColor = () => {
  if (Platform.OS === 'ios') return '#1a1a1a';
  return '#fff';
};

export default function ContigoTab() {
  const tabNavigation = useNavigation();
  const stackNavRef = useRef<any>(null);

  useEffect(() => {
    const unsubscribe = (tabNavigation as any).addListener(
      'tabPress',
      (e: any) => {
        if (stackNavRef.current?.canGoBack()) {
          if (e?.preventDefault) e.preventDefault();
          setTimeout(() => {
            stackNavRef.current?.dispatch(StackActions.popToTop());
          }, 50);
        }
      },
    );
    return unsubscribe;
  }, [tabNavigation]);

  return (
    <Stack.Navigator
      initialRouteName="ContigoHome"
      screenOptions={({ navigation }) => {
        stackNavRef.current = navigation;
        return {
          headerBackTitle: 'Atrás',
          headerStyle: getHeaderStyle() as any,
          headerTintColor: getTextColor(),
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: 18,
            color: getTextColor(),
          },
          headerTitleAlign: 'center',
          headerStatusBarHeight: Platform.OS === 'web' ? 0 : undefined,
          headerTransparent: false,
          headerBackground: () =>
            Platform.OS === 'ios' ? (
              <GlassHeader tintColor={TINT} />
            ) : undefined,
        };
      }}
    >
      <Stack.Screen
        name="ContigoHome"
        component={ContigoHomeScreen}
        options={{
          title: 'Contigo',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Evangelio"
        component={EvangelioScreen}
        options={{ title: 'Evangelio del Día' }}
      />
      <Stack.Screen
        name="Oracion"
        component={OracionScreen}
        options={{ title: 'Mi Rato de Oración' }}
      />
    </Stack.Navigator>
  );
}

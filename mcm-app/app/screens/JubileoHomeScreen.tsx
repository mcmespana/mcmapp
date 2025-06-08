import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ViewStyle, TextStyle, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { JubileoStackParamList } from '../(tabs)/jubileo';

interface NavigationItem {
  label: string;
  icon: string;
  target: keyof JubileoStackParamList;
  backgroundColor: string;
}

const navigationItems: NavigationItem[] = [
  { label: 'Horario', icon: '⏰', target: 'Horario', backgroundColor: '#FF8A65' },
  { label: 'Materiales', icon: '📦', target: 'Materiales', backgroundColor: '#4FC3F7' },
  { label: 'Visitas', icon: '🚌', target: 'Visitas', backgroundColor: '#81C784' },
  { label: 'Profundiza', icon: '📖', target: 'Profundiza', backgroundColor: '#BA68C8' },
  { label: 'Grupos', icon: '👥', target: 'Grupos', backgroundColor: '#FFD54F' },
  { label: 'Contactos', icon: '☎️', target: 'Contactos', backgroundColor: '#9FA8DA' },
];

export default function JubileoHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<JubileoStackParamList>>();
  const scheme = useColorScheme();
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const { width, height } = useWindowDimensions();
  const itemWidth = width / 2;
  const itemHeight = height / 3;
  const iconSize = 48;
  const labelFontSize = 18;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[scheme ?? 'light'].background }]}>
      {navigationItems.map((item, idx) => (
        <TouchableOpacity
          key={idx}
          style={[
            styles.item,
            { width: itemWidth, height: itemHeight, backgroundColor: item.backgroundColor },
          ]}
          onPress={() => navigation.navigate(item.target as any)}
          activeOpacity={0.85}
        >
          <Text style={[styles.iconPlaceholder, { color: '#fff', fontSize: iconSize }]}>{item.icon}</Text>
          <Text style={[styles.rectangleLabel, { color: '#fff', fontSize: labelFontSize }]}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </SafeAreaView>
  );
}

interface Styles {
  container: ViewStyle;
  item: ViewStyle;
  headerWrapper: ViewStyle;
  headerText: TextStyle;
  iconPlaceholder: TextStyle;
  rectangleLabel: TextStyle;
}

const createStyles = (scheme: 'light' | 'dark' | null) => {
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create<Styles>({
    container: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
    },
    item: {
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 16,
    },
  headerWrapper: {
    marginBottom: spacing.lg,
  },
  headerText: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    color: theme.text,
  },
  iconPlaceholder: {
    fontWeight: 'bold',
    marginBottom: spacing.sm,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.08)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 2,
  },
  rectangleLabel: {
    ...(typography.button as TextStyle),
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  });
};

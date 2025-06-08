import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity, FlatList, useWindowDimensions, ViewStyle, TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card } from 'react-native-paper';

import colors from '@/constants/colors';
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
];

export default function JubileoHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<JubileoStackParamList>>();
  const scheme = useColorScheme();
  const { width } = useWindowDimensions();

  let numColumns = 2;
  if (width >= 1100) {
    numColumns = 4;
  } else if (width >= 700) {
    numColumns = 3;
  }

  // Tamaños responsivos
  // Tamaños responsivos SOLO para el cuadrado, icono/texto siempre igual
  const iconSize = 48;
  const labelFontSize = 18;
  let dynamicMaxWidth = 220;
  if (width < 400) {
    dynamicMaxWidth = 120;
  } else if (width < 700) {
    dynamicMaxWidth = 180;
  } else if (width >= 1100) {
    dynamicMaxWidth = 800;
  } else {
    dynamicMaxWidth = 220;
  }

  const renderItem = ({ item }: { item: NavigationItem }) => {
    return (
      <TouchableOpacity
        style={[styles.item, { maxWidth: dynamicMaxWidth, aspectRatio: 1 }]}
        onPress={() => {
          navigation.navigate(item.target as any);
        }}
        activeOpacity={0.85}
      >
        <View style={[styles.card, { backgroundColor: item.backgroundColor }]}> 
          <View style={styles.cardContent}>
            <Text style={[styles.iconPlaceholder, { color: '#fff', fontSize: iconSize }]}>{item.icon}</Text>
            <Text style={[styles.rectangleLabel, { color: '#fff', fontSize: labelFontSize }]}>{item.label}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Si el número de botones es impar, añade un placeholder invisible para cuadrar la última fila
  let itemsToShow = navigationItems;
  if (navigationItems.length % numColumns !== 0) {
    const placeholdersToAdd = numColumns - (navigationItems.length % numColumns);
    itemsToShow = [
      ...navigationItems,
      ...Array(placeholdersToAdd).fill({ label: '', icon: '', target: '' as any, backgroundColor: 'transparent', isPlaceholder: true })
    ];
  }

  const renderItemWithPlaceholder = ({ item }: { item: NavigationItem & { isPlaceholder?: boolean } }) => {
    if (item.isPlaceholder) {
      return <View style={[styles.item, { backgroundColor: 'transparent' }]} pointerEvents="none" />;
    }
    return renderItem({ item });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={itemsToShow}
        renderItem={renderItemWithPlaceholder}
        keyExtractor={(item, idx) => item.label + idx}
        numColumns={numColumns}
        key={numColumns.toString()}
        contentContainerStyle={[
          styles.container,
          { flexGrow: 1, paddingTop: spacing.md, paddingBottom: spacing.md },
          width >= 1100 && { alignSelf: 'center', maxWidth: 1200, justifyContent: 'flex-start', alignItems: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

interface Styles {
  container: ViewStyle;
  item: ViewStyle;
  card: ViewStyle;
  cardContent: ViewStyle;
  headerWrapper: ViewStyle;
  headerText: TextStyle;
  iconPlaceholder: TextStyle;
  rectangleLabel: TextStyle;
}

const styles = StyleSheet.create<Styles>({
  container: {
    backgroundColor: colors.background,
    // padding eliminado para evitar espacio en blanco excesivo
  },
  item: {
    flex: 1,
    margin: spacing.sm,
    aspectRatio: 1,
    alignItems: 'stretch',
    minWidth: 100,
    // maxWidth se aplica dinámicamente en el renderItem
  },
  card: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerWrapper: {
    marginBottom: spacing.lg,
  },
  headerText: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    color: colors.text,
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

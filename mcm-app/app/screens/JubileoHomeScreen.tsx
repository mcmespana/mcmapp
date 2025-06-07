import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity, FlatList, Dimensions, ViewStyle, TextStyle } from 'react-native';
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
  color: string;
}

const navigationItems: NavigationItem[] = [
  { label: 'Horario', icon: '⏰', target: 'Horario', backgroundColor: '#FF8A65', color: colors.black },
  { label: 'Materiales', icon: '📦', target: 'Materiales', backgroundColor: '#4FC3F7', color: colors.black },
  { label: 'Visitas', icon: '🚌', target: 'Visitas', backgroundColor: '#81C784', color: colors.black },
  { label: 'Profundiza', icon: '📖', target: 'Profundiza', backgroundColor: '#BA68C8', color: colors.black },
  { label: 'Grupos', icon: '👥', target: 'Grupos', backgroundColor: '#FFD54F', color: colors.black },
];

const { width } = Dimensions.get('window');
const numColumns = width > 700 ? 3 : 2;

export default function JubileoHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<JubileoStackParamList>>();

  const renderItem = ({ item }: { item: NavigationItem }) => (
    <TouchableOpacity style={styles.item} onPress={() => {
      navigation.navigate(item.target as any);
    }}>
      <Card style={[styles.card, { backgroundColor: item.backgroundColor }]} elevation={2}>
        <Card.Content style={styles.cardContent}>
          <Text style={[styles.iconPlaceholder, { color: item.color }]}>{item.icon}</Text>
          <Text style={[styles.rectangleLabel, { color: item.color }]}>{item.label}</Text>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  return (
    <FlatList
      data={navigationItems}
      renderItem={renderItem}
      keyExtractor={(item) => item.label}
      numColumns={numColumns}
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <View style={styles.headerWrapper}>
          <Text style={styles.headerText}>¡Bienvenido al Jubileo!</Text>
        </View>
      }
    />
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
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  item: {
    flex: 1,
    margin: spacing.sm,
  },
  card: {
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
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
    fontSize: 48,
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
    fontSize: 18,
    letterSpacing: 0.5,
    marginTop: 2,
  },
});

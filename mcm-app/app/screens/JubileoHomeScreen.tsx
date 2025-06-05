import React from 'react';
import { View, StyleSheet, Dimensions, Text, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
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
const gap = spacing.lg;
const itemPerRow = width > 700 ? 3 : 2;
const totalGapSize = (itemPerRow - 1) * gap;
const windowWidth = width - spacing.lg * 2;
const maxRectSize = 180;
const rectDimension = Math.min((windowWidth - totalGapSize) / itemPerRow, maxRectSize);

export default function JubileoHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<JubileoStackParamList>>();
  return (
    <View style={styles.container}>
      <View style={styles.gridContainer}>
        {navigationItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => navigation.navigate(item.target)}
            style={styles.linkWrapper}
          >
            <Card style={[styles.rectangle, { backgroundColor: item.backgroundColor }]} elevation={2}>
              <Card.Content style={styles.cardContent}>
                <Text style={[styles.iconPlaceholder, { color: item.color }]}>{item.icon}</Text>
                <Text style={[styles.rectangleLabel, { color: item.color }]}>{item.label}</Text>
              </Card.Content>
            </Card>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

interface Styles {
  container: ViewStyle;
  gridContainer: ViewStyle;
  rectangle: ViewStyle;
  cardContent: ViewStyle;
  linkWrapper: ViewStyle;
  iconPlaceholder: TextStyle;
  rectangleLabel: TextStyle;
}

const styles = StyleSheet.create<Styles>({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: gap,
  },
  rectangle: {
    width: rectDimension,
    height: rectDimension,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  linkWrapper: {
    width: rectDimension,
    height: rectDimension,
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

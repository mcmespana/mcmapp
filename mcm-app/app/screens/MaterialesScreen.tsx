import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import spacing from '@/constants/spacing';
import { useJubileoData } from '@/contexts/JubileoDataContext';
import DateSelector from '@/components/DateSelector';
import { JubileoStackParamList } from '../(tabs)/jubileo';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

interface Actividad {
  nombre: string;
  color?: string;
  emoji?: string;
  paginas: any[];
}

type Nav = NativeStackNavigationProp<JubileoStackParamList, 'MaterialPages'>;

export default function MaterialesScreen() {
  const navigation = useNavigation<Nav>();
  const scheme = useColorScheme();
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const { materiales } = useJubileoData();
  const [index, setIndex] = useState(0);
  const fechas = (materiales ?? []).map((d: any) => ({ fecha: d.fecha }));
  const dia = materiales ? materiales[index] : { actividades: [], fecha: '' };
  if (!materiales) {
    return <View style={styles.container}><Text>Cargando...</Text></View>;
  }

  return (
    <View style={styles.container}>
      <DateSelector dates={fechas} selectedDate={dia.fecha} onSelectDate={(_, i) => setIndex(i)} />
      <ScrollView contentContainerStyle={styles.list}>
        {dia.actividades.map((act: Actividad, idx: number) => (
          <TouchableOpacity
            key={idx}
            style={[styles.card, { backgroundColor: act.color || colors.primary }]}
            onPress={() => navigation.navigate('MaterialPages', { actividad: act, fecha: dia.fecha })}
          >
            <Text style={styles.emoji}>{act.emoji}</Text>
            <Text style={styles.cardText}>{act.nombre.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (scheme: 'light' | 'dark') => {
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    list: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
    },
    card: {
      borderRadius: 12,
      paddingVertical: spacing.xl,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    emoji: {
      fontSize: 40,
      marginBottom: spacing.sm,
    },
    cardText: {
      color: colors.white,
      fontWeight: 'bold',
      fontSize: 18,
    },
  });
};

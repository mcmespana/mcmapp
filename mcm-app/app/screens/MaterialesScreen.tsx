import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Text,
} from 'react-native';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import useFontScale from '@/hooks/useFontScale';
import spacing from '@/constants/spacing';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import DateSelector from '@/components/DateSelector';
import { JubileoStackParamList } from '../(tabs)/jubileo';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';

interface Actividad {
  nombre: string;
  color?: string;
  emoji?: string;
  paginas: any[];
}

type Nav = NativeStackNavigationProp<JubileoStackParamList, 'MaterialPages'>;
type MaterialesScreenRoute = RouteProp<JubileoStackParamList, 'Materiales'>;

export default function MaterialesScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<MaterialesScreenRoute>();
  const scheme = useColorScheme();
  const fontScale = useFontScale(1.2);
  const styles = React.useMemo(
    () => createStyles(scheme, fontScale),
    [scheme, fontScale],
  );
  const { data: materialesData, loading } = useFirebaseData<any[]>(
    'jubileo/materiales',
    'jubileo_materiales',
  );
  
  // Get initial day index from navigation params, default to 0
  const initialDayIndex = route.params?.initialDayIndex ?? 0;
  const [index, setIndex] = useState(initialDayIndex);
  const fechas = materialesData
    ? materialesData.map((d) => ({ fecha: d.fecha }))
    : [];
  const dia = materialesData ? materialesData[index] : null;

  if (!dia) {
    return <ProgressWithMessage message="Cargando materiales..." />;
  }

  if (loading) {
    return <ProgressWithMessage message="Actualizando materiales..." />;
  }

  return (
    <View style={styles.container}>
      <DateSelector
        dates={fechas}
        selectedDate={dia.fecha}
        onSelectDate={(_, i) => setIndex(i)}
      />
      <ScrollView contentContainerStyle={styles.list}>
        {dia.actividades.map((act: Actividad, idx: number) => (
          <TouchableOpacity
            key={idx}
            style={[
              styles.card,
              { backgroundColor: act.color || colors.primary },
            ]}
            onPress={() =>
              navigation.navigate('MaterialPages', {
                actividad: act,
                fecha: dia.fecha,
              })
            }
          >
            <Text style={styles.emoji}>{act.emoji}</Text>
            <Text style={styles.cardText}>{act.nombre.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (scheme: 'light' | 'dark', scale: number) => {
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
      fontSize: 40 * scale,
      marginBottom: spacing.sm,
    },
    cardText: {
      color: colors.white,
      fontWeight: 'bold',
      fontSize: 18 * scale,
    },
  });
};

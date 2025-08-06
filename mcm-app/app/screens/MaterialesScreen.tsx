import React, { useState, useEffect } from 'react';
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
  
  // Function to find the closest date index
  const getClosestDateIndex = (data: any[]) => {
    if (!data || data.length === 0) return 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day
    
    let closestFutureIndex = -1;
    let minFutureDistance = Number.MAX_SAFE_INTEGER;
    let lastDateIndex = data.length - 1; // Default to last if all dates are past
    
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      if (!item.fecha) continue;
      
      // Parse the date string (assuming format like "28 de enero")
      const dateStr = item.fecha;
      const eventDate = parseDateString(dateStr);
      
      if (eventDate) {
        const distance = eventDate.getTime() - today.getTime();
        
        // If this date is today or in the future
        if (distance >= 0 && distance < minFutureDistance) {
          minFutureDistance = distance;
          closestFutureIndex = i;
        }
      }
    }
    
    // If we found a future date, use it; otherwise use the last date
    return closestFutureIndex >= 0 ? closestFutureIndex : lastDateIndex;
  };
  
  // Function to parse date strings like "28 de enero" to Date object
  const parseDateString = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    
    const months: { [key: string]: number } = {
      'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3,
      'mayo': 4, 'junio': 5, 'julio': 6, 'agosto': 7,
      'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
    };
    
    const parts = dateStr.toLowerCase().split(' de ');
    if (parts.length !== 2) return null;
    
    const day = parseInt(parts[0]);
    const monthName = parts[1];
    const monthIndex = months[monthName];
    
    if (isNaN(day) || monthIndex === undefined) return null;
    
    // Assume current year, but if month has passed, use next year
    const currentYear = new Date().getFullYear();
    let year = currentYear;
    
    const testDate = new Date(year, monthIndex, day);
    const today = new Date();
    
    // If the date is more than 6 months in the past, it's probably next year
    if (testDate < today && (today.getTime() - testDate.getTime()) > (6 * 30 * 24 * 60 * 60 * 1000)) {
      year = currentYear + 1;
    }
    
    return new Date(year, monthIndex, day);
  };
  
  // Get initial day index from navigation params, or calculate closest date
  const getInitialIndex = () => {
    if (route.params?.initialDayIndex !== undefined) {
      return route.params.initialDayIndex;
    }
    return materialesData ? getClosestDateIndex(materialesData) : 0;
  };
  
  const [index, setIndex] = useState(getInitialIndex);
  
  // Update index when materialesData loads (only if no specific day was requested)
  useEffect(() => {
    if (materialesData && materialesData.length > 0 && route.params?.initialDayIndex === undefined) {
      setIndex(getClosestDateIndex(materialesData));
    }
  }, [materialesData, route.params?.initialDayIndex]);
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

import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Animated } from 'react-native';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import useFontScale from '@/hooks/useFontScale';
import spacing from '@/constants/spacing';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import DateSelector from '@/components/DateSelector';
import EventItem, { EventItemData } from '@/components/EventItem';
import { ThemedText } from '@/components/ThemedText';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MasStackParamList } from '../(tabs)/mas';

type Nav = NativeStackNavigationProp<MasStackParamList, 'Materiales'>;

export default function HorarioScreen() {
  const navigation = useNavigation<Nav>();
  const scheme = useColorScheme();
  const fontScale = useFontScale();
  const styles = React.useMemo(
    () => createStyles(scheme, fontScale),
    [scheme, fontScale],
  );
  const { data: horarioData, loading } = useFirebaseData<any[]>(
    'jubileo/horario',
    'jubileo_horario',
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
      enero: 0,
      febrero: 1,
      marzo: 2,
      abril: 3,
      mayo: 4,
      junio: 5,
      julio: 6,
      agosto: 7,
      septiembre: 8,
      octubre: 9,
      noviembre: 10,
      diciembre: 11,
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
    if (
      testDate < today &&
      today.getTime() - testDate.getTime() > 6 * 30 * 24 * 60 * 60 * 1000
    ) {
      year = currentYear + 1;
    }

    return new Date(year, monthIndex, day);
  };

  const [index, setIndex] = useState(() => {
    return horarioData ? getClosestDateIndex(horarioData) : 0;
  });

  // Update index when horarioData loads
  useEffect(() => {
    if (horarioData && horarioData.length > 0) {
      const newIndex = getClosestDateIndex(horarioData);
      console.log(
        'Setting horario index to:',
        newIndex,
        'out of',
        horarioData.length,
        'days',
      );
      setIndex(newIndex);
    }
  }, [horarioData]);

  // Animation values for last day
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const fechas = horarioData
    ? horarioData.map((d) => ({ fecha: d.fecha, titulo: d.titulo }))
    : [];
  const dia = horarioData ? horarioData[index] : null;

  // Calculate progressive green color based on day index
  const getProgressiveGreenColor = (dayIndex: number, totalDays: number) => {
    if (totalDays <= 1) return colors.success;

    // Base green color: #A3BD31
    const baseR = 163;
    const baseG = 189;
    const baseB = 49;

    // Calculate darkness factor (0 to 0.6, so it gets darker but not black)
    const darknessFactor = (dayIndex / (totalDays - 1)) * 0.6;

    const newR = Math.round(baseR * (1 - darknessFactor));
    const newG = Math.round(baseG * (1 - darknessFactor));
    const newB = Math.round(baseB * (1 - darknessFactor));

    return `rgb(${newR}, ${newG}, ${newB})`;
  };

  // Check if current day is the last day (has "Despedida" event)
  const isLastDay =
    dia?.eventos?.some((evento: any) =>
      evento.nombre?.toLowerCase().includes('despedida'),
    ) || false;

  // Trigger animations for last day
  useEffect(() => {
    if (isLastDay) {
      // Subtle shake animation
      const shake = () => {
        Animated.sequence([
          Animated.timing(shakeAnim, {
            toValue: 3,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnim, {
            toValue: -3,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnim, {
            toValue: 3,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnim, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          }),
        ]).start();
      };

      // Subtle fade animation
      const fade = () => {
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 0.7,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Repeat fade animation
          setTimeout(fade, 2000);
        });
      };

      // Start animations with delays
      setTimeout(shake, 1000);
      fade();

      // Repeat shake every 8 seconds
      const shakeInterval = setInterval(shake, 8000);

      return () => clearInterval(shakeInterval);
    }
  }, [isLastDay, shakeAnim, fadeAnim]);

  const currentColor = horarioData
    ? getProgressiveGreenColor(index, horarioData.length)
    : colors.success;

  // Handle navigation to materials with specific day
  const handleNavigateToMateriales = (dayIndex: number) => {
    navigation.navigate('Materiales', { initialDayIndex: dayIndex });
  };

  const dynamicStyles = React.useMemo(
    () =>
      createDynamicStyles(
        scheme,
        fontScale,
        currentColor,
        isLastDay,
        shakeAnim,
        fadeAnim,
      ),
    [scheme, fontScale, currentColor, isLastDay, shakeAnim, fadeAnim],
  );

  if (!dia) {
    return <ProgressWithMessage message="Cargando horario..." />;
  }

  if (loading) {
    return <ProgressWithMessage message="Actualizando horario..." />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <DateSelector
          dates={fechas}
          selectedDate={dia.fecha}
          onSelectDate={(_, i) => setIndex(i)}
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.eventsContainer}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            dynamicStyles.titleWrapper,
            isLastDay && {
              transform: [{ translateX: shakeAnim }],
              opacity: fadeAnim,
            },
          ]}
        >
          <ThemedText style={styles.titleText} selectable>
            {dia.titulo}
          </ThemedText>
          {isLastDay && (
            <ThemedText style={styles.sadEmoji} selectable>
              😢
            </ThemedText>
          )}
        </Animated.View>
        {dia.eventos.map(
          (ev: EventItemData, idx: React.Key | null | undefined) => (
            <EventItem
              key={idx}
              event={ev}
              dayIndex={index}
              onNavigateToMateriales={handleNavigateToMateriales}
            />
          ),
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (scheme: 'light' | 'dark', scale: number) => {
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: scheme === 'dark' ? theme.background : '#F8F9FA',
    },
    headerSection: {
      backgroundColor: theme.background,
      paddingBottom: spacing.md,
      shadowColor: theme.shadow,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
      zIndex: 1,
    },
    titleText: {
      color: colors.white,
      textAlign: 'center',
      fontWeight: '700',
      fontSize: 20 * scale,
      letterSpacing: 0.5,
    },
    sadEmoji: {
      fontSize: 16 * scale,
      textAlign: 'center',
      marginTop: spacing.xs / 2,
    },
    eventsContainer: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      paddingBottom: spacing.xl * 2, // Extra padding at bottom
    },
  });
};

const createDynamicStyles = (
  scheme: 'light' | 'dark',
  scale: number,
  currentColor: string,
  isLastDay: boolean,
  shakeAnim: Animated.Value,
  fadeAnim: Animated.Value,
) => {
  return StyleSheet.create({
    titleWrapper: {
      backgroundColor: currentColor,
      marginHorizontal: spacing.lg,
      marginTop: spacing.md, // Espaciado desde el navegador de días
      padding: spacing.md,
      borderRadius: 16,
      marginBottom: spacing.sm,
      shadowColor: currentColor,
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
      // Add extra styling for last day
      ...(isLastDay && {
        borderWidth: 2,
        borderColor: '#FF6B6B', // Subtle red border for sadness
      }),
    },
  });
};

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
import { JubileoStackParamList } from '../(tabs)/jubileo';

type Nav = NativeStackNavigationProp<JubileoStackParamList, 'Materiales'>;

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
  const [index, setIndex] = useState(0);
  
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
          <ThemedText style={styles.titleText}>{dia.titulo}</ThemedText>
          {isLastDay && <ThemedText style={styles.sadEmoji}>😢</ThemedText>}
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

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Platform,
} from 'react-native';
import { Skeleton } from 'heroui-native';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import useFontScale from '@/hooks/useFontScale';
import spacing from '@/constants/spacing';
import { radii } from '@/constants/uiStyles';
import PageContainer from '@/components/ui/PageContainer';
import ScreenHero from '@/components/ui/ScreenHero';
import ComingSoon from '@/components/ui/ComingSoon';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useCurrentEvent } from '@/hooks/useCurrentEvent';
import { getEventCacheKey, getEventFirebasePath } from '@/constants/events';
import { getClosestDateIndex } from '@/utils/dateUtils';
import DateSelector from '@/components/DateSelector';
import EventItem, { EventItemData } from '@/components/EventItem';
import { ThemedText } from '@/components/ThemedText';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MasStackParamList } from '../(tabs)/mas';

type Nav = NativeStackNavigationProp<MasStackParamList, 'Materiales'>;

const isWeb = Platform.OS === 'web';

export default function HorarioScreen() {
  const navigation = useNavigation<Nav>();
  const scheme = useColorScheme();
  const fontScale = useFontScale();
  const styles = React.useMemo(
    () => createStyles(scheme, fontScale),
    [scheme, fontScale],
  );
  const event = useCurrentEvent();
  const { data: horarioData, loading } = useFirebaseData<any[]>(
    getEventFirebasePath(event, 'horario'),
    getEventCacheKey(event, 'horario'),
  );

  const [index, setIndex] = useState(() => {
    return horarioData ? getClosestDateIndex(horarioData) : 0;
  });

  // Update index when horarioData loads — abrimos en el día más cercano a hoy.
  useEffect(() => {
    if (horarioData && horarioData.length > 0) {
      setIndex(getClosestDateIndex(horarioData));
    }
  }, [horarioData]);

  // En web ponemos el título "Horario" arriba en el propio header (con el botón
  // atrás separado del borde) y eliminamos el hero grande de la pantalla, para
  // que el calendario quede pegado al header. En iOS/Android se mantiene el
  // hero del contenido.
  useLayoutEffect(() => {
    if (isWeb) {
      navigation.setOptions({
        headerTitle: () => <Text style={styles.webHeaderTitle}>Horario</Text>,
        headerTitleAlign: 'left',
        headerLeftContainerStyle: { paddingLeft: spacing.md },
      } as any);
    }
  }, [navigation, styles.webHeaderTitle]);

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
    navigation.navigate('Materiales', {
      initialDayIndex: dayIndex,
      eventId: event.id,
    });
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
    const empty = !loading && (!horarioData || horarioData.length === 0);
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors[scheme ?? 'light'].background,
        }}
      >
        {!isWeb && <ScreenHero title="Horario" />}
        {empty ? (
          <ComingSoon accentColor={event.tintColor} />
        ) : (
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.lg,
              gap: spacing.md,
            }}
          >
            <Skeleton style={{ height: 54, borderRadius: radii.xl }} />
            {[0, 1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                style={{ height: 72, borderRadius: radii.lg }}
              />
            ))}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!isWeb && <ScreenHero title="Horario" />}
      <View style={styles.headerSection}>
        <DateSelector
          dates={fechas}
          selectedDate={dia.fecha}
          onSelectDate={(_, i) => setIndex(i)}
        />
      </View>
      <PageContainer>
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
          <View style={styles.timeline}>
            {dia.eventos.map((ev: EventItemData, idx: number) => (
              <EventItem
                key={idx}
                event={ev}
                dayIndex={index}
                accentColor={currentColor}
                isFirst={idx === 0}
                isLast={idx === dia.eventos.length - 1}
                onNavigateToMateriales={handleNavigateToMateriales}
              />
            ))}
          </View>
        </ScrollView>
      </PageContainer>
    </View>
  );
}

const createStyles = (scheme: 'light' | 'dark' | null, scale: number) => {
  const theme = Colors[scheme ?? 'light'];
  const isDark = scheme === 'dark';
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? theme.background : '#F8F9FA',
    },
    webHeaderTitle: {
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.4,
      color: theme.text,
    },
    headerSection: {
      backgroundColor: theme.background,
      paddingBottom: spacing.sm,
      shadowColor: theme.shadow,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 4,
      zIndex: 1,
    },
    titleText: {
      color: colors.white,
      textAlign: 'center',
      fontWeight: '800',
      fontSize: 19 * scale,
      letterSpacing: 0.3,
    },
    sadEmoji: {
      fontSize: 16 * scale,
      textAlign: 'center',
      marginTop: spacing.xs / 2,
    },
    timeline: {
      marginTop: spacing.md,
    },
    eventsContainer: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      paddingBottom: Platform.OS === 'ios' ? 100 : spacing.xl * 2,
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
      padding: spacing.md,
      borderRadius: 18,
      marginBottom: spacing.xs,
      ...Platform.select({
        web: {
          // @ts-ignore
          boxShadow: `0 6px 18px ${currentColor}55`,
        },
        default: {
          shadowColor: currentColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 6,
        },
      }),
      // Add extra styling for last day
      ...(isLastDay && {
        borderWidth: 2,
        borderColor: '#FF6B6B', // Subtle red border for sadness
      }),
    },
  });
};

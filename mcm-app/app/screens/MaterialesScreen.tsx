import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text, Platform } from 'react-native';
import { PressableFeedback, Skeleton } from 'heroui-native';
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
import DateSelector from '@/components/DateSelector';
import { MasStackParamList } from '../(tabs)/mas';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';

interface Actividad {
  nombre: string;
  color?: string;
  emoji?: string;
  paginas: any[];
}

type Nav = NativeStackNavigationProp<MasStackParamList, 'MaterialPages'>;
type MaterialesScreenRoute = RouteProp<MasStackParamList, 'Materiales'>;

function parseDateString(dateStr: string): Date | null {
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

  const currentYear = new Date().getFullYear();
  let year = currentYear;

  const testDate = new Date(year, monthIndex, day);
  const today = new Date();

  if (
    testDate < today &&
    today.getTime() - testDate.getTime() > 6 * 30 * 24 * 60 * 60 * 1000
  ) {
    year = currentYear + 1;
  }

  return new Date(year, monthIndex, day);
}

function getClosestDateIndex(data: any[]): number {
  if (!data || data.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let closestFutureIndex = -1;
  let minFutureDistance = Number.MAX_SAFE_INTEGER;
  const lastDateIndex = data.length - 1;

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item.fecha) continue;

    const eventDate = parseDateString(item.fecha);
    if (eventDate) {
      const distance = eventDate.getTime() - today.getTime();
      if (distance >= 0 && distance < minFutureDistance) {
        minFutureDistance = distance;
        closestFutureIndex = i;
      }
    }
  }

  return closestFutureIndex >= 0 ? closestFutureIndex : lastDateIndex;
}

export default function MaterialesScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<MaterialesScreenRoute>();
  const scheme = useColorScheme();
  const fontScale = useFontScale(1.2);
  const styles = React.useMemo(
    () => createStyles(scheme, fontScale),
    [scheme, fontScale],
  );
  const event = useCurrentEvent();
  const { data: materialesData, loading } = useFirebaseData<any[]>(
    getEventFirebasePath(event, 'materiales'),
    getEventCacheKey(event, 'materiales'),
  );

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
    if (
      materialesData &&
      materialesData.length > 0 &&
      route.params?.initialDayIndex === undefined
    ) {
      setIndex(getClosestDateIndex(materialesData));
    }
  }, [materialesData, route.params?.initialDayIndex]);
  const fechas = materialesData
    ? materialesData.map((d) => ({ fecha: d.fecha }))
    : [];
  const dia = materialesData ? materialesData[index] : null;

  if (!dia) {
    const empty = !loading && (!materialesData || materialesData.length === 0);
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors[scheme ?? 'light'].background,
        }}
      >
        <ScreenHero title="Materiales" hideOnWeb />
        {empty ? (
          <ComingSoon accentColor={event.tintColor} />
        ) : (
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              gap: spacing.md,
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                style={{ height: 100, borderRadius: radii.xl }}
              />
            ))}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHero title="Materiales" hideOnWeb />
      <View style={styles.headerSection}>
        <DateSelector
          dates={fechas}
          selectedDate={dia.fecha}
          onSelectDate={(_, i) => setIndex(i)}
        />
      </View>
      <PageContainer>
        <ScrollView contentContainerStyle={styles.list}>
          {dia.actividades.map((act: Actividad, idx: number) => (
            <PressableFeedback
              key={idx}
              style={[
                styles.card,
                { backgroundColor: act.color || colors.primary },
              ]}
              onPress={() =>
                navigation.navigate('MaterialPages', {
                  actividad: act,
                  fecha: dia.fecha,
                  eventId: event.id,
                })
              }
            >
              <PressableFeedback.Highlight />
              <Text style={styles.emoji} selectable>
                {act.emoji}
              </Text>
              <Text style={styles.cardText} selectable>
                {act.nombre.toUpperCase()}
              </Text>
            </PressableFeedback>
          ))}
        </ScrollView>
      </PageContainer>
    </View>
  );
}

const createStyles = (scheme: 'light' | 'dark', scale: number) => {
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    // El DateSelector es un FlatList horizontal: si va suelto como hijo directo
    // de un contenedor flex en columna, crece en vertical y empuja las tarjetas
    // hacia abajo. Envolverlo en una View lo limita a su altura natural.
    headerSection: { backgroundColor: theme.background },
    list: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: Platform.OS === 'ios' ? 100 : spacing.xl,
    },
    card: {
      borderRadius: 16,
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.md,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.md,
      ...Platform.select({
        web: {
          boxShadow: '0 2px 10px rgba(0,0,0,0.10)',
        },
        default: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
          elevation: 3,
        },
      }),
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

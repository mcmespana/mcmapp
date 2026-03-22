// components/contigo/DateNavigator.tsx — ← Date → navigator with liturgical badge
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import LiturgicalBadge from './LiturgicalBadge';
import { useLiturgicalInfo } from '@/hooks/useLiturgicalCalendar';

const DAYS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

interface Props {
  dateStr: string;
  onPrev: () => void;
  onNext: () => void;
  canGoNext?: boolean;
  canGoPrev?: boolean;
}

export default function DateNavigator({
  dateStr,
  onPrev,
  onNext,
  canGoNext = true,
  canGoPrev = true,
}: Props) {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];
  const liturgical = useLiturgicalInfo(dateStr);

  const formattedDate = useMemo(() => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const dayName = DAYS[date.getDay()];
    const monthName = MONTHS[date.getMonth()];
    return `${dayName} ${d} de ${monthName}`;
  }, [dateStr]);

  return (
    <View style={styles.container}>
      <View style={styles.dateRow}>
        <TouchableOpacity
          onPress={onPrev}
          disabled={!canGoPrev}
          style={[styles.arrowBtn, !canGoPrev && { opacity: 0.3 }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Día anterior"
        >
          <MaterialIcons name="chevron-left" size={28} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.center}>
          <Text style={[styles.dateText, { color: theme.text }]}>
            {formattedDate}
          </Text>
          <LiturgicalBadge info={liturgical} compact />
        </View>

        <TouchableOpacity
          onPress={onNext}
          disabled={!canGoNext}
          style={[styles.arrowBtn, !canGoNext && { opacity: 0.3 }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Día siguiente"
        >
          <MaterialIcons name="chevron-right" size={28} color={theme.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arrowBtn: {
    padding: 4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 17,
    fontWeight: '700',
  },
});

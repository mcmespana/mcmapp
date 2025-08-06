import React from 'react';
import {
  FlatList,
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import spacing from '@/constants/spacing';

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
const WEEKDAYS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

export interface DateOption {
  fecha: string;
  titulo?: string;
}

interface Props {
  dates: DateOption[];
  selectedDate: string;
  onSelectDate: (date: string, index: number) => void;
}

export default function DateSelector({
  dates,
  selectedDate,
  onSelectDate,
}: Props) {
  const scheme = useColorScheme();
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);

  const renderItem = ({ item, index }: { item: DateOption; index: number }) => {
    const date = new Date(item.fecha);
    const label = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
    const weekday = WEEKDAYS[date.getDay()];
    const selected = item.fecha === selectedDate;
    return (
      <TouchableOpacity onPress={() => onSelectDate(item.fecha, index)}>
        <View style={[styles.item, selected && styles.itemSelected]}>
          <Text
            style={[styles.dateText, selected && styles.textSelected]}
            selectable
          >
            {label}
          </Text>
          <Text
            style={[styles.weekdayText, selected && styles.textSelected]}
            selectable
          >
            {weekday}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };
  return (
    <FlatList
      data={dates}
      keyExtractor={(d) => d.fecha}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
      renderItem={renderItem}
    />
  );
}

const createStyles = (scheme: 'light' | 'dark') => {
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    list: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    item: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: 12,
      backgroundColor: scheme === 'dark' ? '#3E3E42' : '#eeeeee',
      marginRight: spacing.md,
      alignItems: 'center',
      minWidth: 90,
    },
    itemSelected: {
      backgroundColor: colors.accent,
    },
    dateText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
    },
    weekdayText: {
      fontSize: 14,
      textTransform: 'capitalize',
      color: theme.text,
    },
    textSelected: {
      color: colors.white,
    },
  });
};

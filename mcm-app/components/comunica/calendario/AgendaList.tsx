// La Agenda (C6): el mes por días, solo los días con algo. Vacío: «No hay
// actividades en estas fechas».

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import typography from '@/constants/typography';
import { agendaDays, type CalendarItem } from '@/utils/comunica/calendar';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import DayList from './DayList';

export default function AgendaList({
  byDay,
  month,
  onPress,
}: {
  byDay: Map<string, CalendarItem[]>;
  month: string;
  onPress: (item: CalendarItem) => void;
}) {
  const t = useComunicaTheme();
  const days = agendaDays(byDay, month);
  if (days.length === 0) {
    return (
      <Text style={[styles.empty, { color: t.textSecondary }]}>
        No hay actividades en estas fechas
      </Text>
    );
  }
  return (
    <View style={styles.wrap}>
      {days.map((d) => (
        <DayList key={d} day={d} items={byDay.get(d) ?? []} onPress={onPress} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 20 },
  empty: { ...typography.body, textAlign: 'center', paddingVertical: 24 },
});

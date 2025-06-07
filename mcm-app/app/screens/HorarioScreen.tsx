import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import horarioData from '@/assets/jubileo-horario.json';
import DateSelector from '@/components/DateSelector';
import EventItem from '@/components/EventItem';
import { ThemedText } from '@/components/ThemedText';

export default function HorarioScreen() {
  const [index, setIndex] = useState(0);
  const fechas = horarioData.map((d) => ({ fecha: d.fecha, titulo: d.titulo }));
  const dia = horarioData[index];

  return (
    <View style={styles.container}>
      <DateSelector
        dates={fechas}
        selectedDate={dia.fecha}
        onSelectDate={(_, i) => setIndex(i)}
      />
      <View style={styles.titleWrapper}>
        <ThemedText style={styles.titleText}>{dia.titulo}</ThemedText>
      </View>
      <ScrollView contentContainerStyle={styles.eventsContainer}>
        {dia.eventos.map((ev, idx) => (
          <EventItem key={idx} event={ev} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  titleWrapper: {
    backgroundColor: colors.danger,
    marginHorizontal: spacing.lg,
    padding: spacing.sm,
    borderRadius: 50,
    marginBottom: spacing.md,
  },
  titleText: {
    color: colors.white,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 18,
  },
  eventsContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
});

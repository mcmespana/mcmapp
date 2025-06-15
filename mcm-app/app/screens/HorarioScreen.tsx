import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import spacing from '@/constants/spacing';
import { useJubileoData } from '@/contexts/JubileoDataContext';
import DateSelector from '@/components/DateSelector';
import EventItem from '@/components/EventItem';
import { ThemedText } from '@/components/ThemedText';

export default function HorarioScreen() {
  const scheme = useColorScheme();
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const { horario } = useJubileoData();
  const [index, setIndex] = useState(0);
  const fechas = (horario ?? []).map((d: any) => ({ fecha: d.fecha, titulo: d.titulo }));
  const dia = horario ? horario[index] : { eventos: [], titulo: '', fecha: '' };
  if (!horario) {
    return <View style={styles.container}><ThemedText>Cargando...</ThemedText></View>;
  }

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

const createStyles = (scheme: 'light' | 'dark') => {
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
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
};

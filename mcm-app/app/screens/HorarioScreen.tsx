import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import useFontScale from '@/hooks/useFontScale';
import spacing from '@/constants/spacing';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import DateSelector from '@/components/DateSelector';
import EventItem, { EventItemData } from '@/components/EventItem';
import { ThemedText } from '@/components/ThemedText';

export default function HorarioScreen() {
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
  const fechas = horarioData
    ? horarioData.map((d) => ({ fecha: d.fecha, titulo: d.titulo }))
    : [];
  const dia = horarioData ? horarioData[index] : null;

  if (!dia) {
    return <ProgressWithMessage message="Cargando horario..." />;
  }

  if (loading) {
    return <ProgressWithMessage message="Actualizando horario..." />;
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
        {dia.eventos.map(
          (ev: EventItemData, idx: React.Key | null | undefined) => (
            <EventItem key={idx} event={ev} />
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
      fontSize: 18 * scale,
    },
    eventsContainer: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
    },
  });
};

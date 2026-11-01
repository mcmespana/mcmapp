// La leyenda bajo la rejilla, sin frase (C6; `sticpa_calendar_legend_html`):
// un punto de color y su palabra, solo los estados encendidos.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radii } from '@/constants/uiStyles';
import typography from '@/constants/typography';
import { BUCKET_LABEL, CALENDAR_LEGEND } from '@/utils/comunica/calendar';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { calendarFill } from './calendarColors';

export default function CalendarLegend() {
  const t = useComunicaTheme();
  return (
    <View style={styles.wrap} accessibilityLabel="Leyenda de colores">
      {CALENDAR_LEGEND.map((b) => (
        <View key={b} style={styles.item}>
          <View
            style={[styles.dot, { backgroundColor: calendarFill(b, t.isDark) }]}
          />
          <Text style={[styles.label, { color: t.textSecondary }]}>
            {BUCKET_LABEL[b]}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 16,
    rowGap: 8,
    paddingHorizontal: 4,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: radii.pillFull },
  label: { ...typography.footnote },
});

// Chip de estado: color por TONO (que sale de la clave interna, no del texto),
// neutro ante la duda. «Pasada», «Sin registro», «Pendiente», «Hoy»…

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radii } from '@/constants/uiStyles';
import typography from '@/constants/typography';
import type { ChipTone } from './theme';
import { useComunicaTheme } from './useComunicaTheme';

interface Props {
  label: string;
  tone?: ChipTone;
}

export default function StatusChip({ label, tone = 'neutral' }: Props) {
  const t = useComunicaTheme();
  const c = t.chip(tone);
  return (
    <View style={[styles.chip, { backgroundColor: c.background }]}>
      <Text style={[styles.label, { color: c.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  label: { ...typography.footnote, fontWeight: '600' },
});

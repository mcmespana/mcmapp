// Chip de estado (`.stic-rec-chip` del plugin): píldora en mayúsculas pequeñas,
// color por TONO (que sale de la clave interna, no del texto), neutro ante la
// duda. «Pasada», «Sin registro», «Pendiente», «Hoy»…
//
// Las mayúsculas son de estilo (`textTransform`), no del texto: lo que se
// escribe y lo que lee la voz sigue siendo «Pasada». `onGradient` es el chip
// que va dentro de un bloque de marca: velo oscuro y texto blanco.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radii } from '@/constants/uiStyles';
import typography from '@/constants/typography';
import type { ChipTone } from './theme';
import { useComunicaTheme } from './useComunicaTheme';

interface Props {
  label: string;
  tone?: ChipTone;
  /** Dentro de un bloque de degradado (la tarjeta destacada). */
  onGradient?: boolean;
}

export default function StatusChip({
  label,
  tone = 'neutral',
  onGradient = false,
}: Props) {
  const t = useComunicaTheme();
  const c = t.chip(tone);
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: onGradient ? t.gradientOverlay : c.background },
      ]}
    >
      <Text
        style={[styles.label, { color: onGradient ? t.onGradient : c.text }]}
      >
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
    borderRadius: radii.pillFull,
  },
  label: {
    ...typography.micro,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: typography.overline.letterSpacing,
  },
});

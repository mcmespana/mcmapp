// Un aviso de una ficha de registro (plan 14, `sticpa_record_note_html`): una línea o dos con su tono (ok, info, aviso, peligro) y, si se quiere, un título.
// Una sola superficie de color, sin barra ni tarjeta dentro de otra. El lector de pantalla lo anuncia como alerta.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useComunicaTheme } from '../useComunicaTheme';

export type RecordNoteTone = 'ok' | 'info' | 'warn' | 'danger';

export default function RecordNote({
  tone = 'info',
  title,
  text,
}: {
  tone?: RecordNoteTone;
  title?: string;
  text: string;
}) {
  const t = useComunicaTheme();
  const chip = t.chip(
    tone === 'ok'
      ? 'positive'
      : tone === 'warn'
        ? 'warning'
        : tone === 'danger'
          ? 'negative'
          : 'info',
  );
  return (
    <View
      accessibilityRole="alert"
      style={[styles.box, { backgroundColor: chip.background }]}
    >
      {title ? (
        <Text style={[styles.title, { color: t.text }]}>{title}</Text>
      ) : null}
      <Text style={[styles.text, { color: t.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radii.md, padding: 16, gap: 4 },
  title: { ...typography.title },
  text: { ...typography.body },
});

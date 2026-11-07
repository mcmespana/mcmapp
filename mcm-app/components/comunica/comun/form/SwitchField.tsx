// Una casilla del plugin (`bool`) como interruptor del sistema: la fila entera
// es la etiqueta y el `AreaSwitch` a la derecha.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import typography from '@/constants/typography';
import AreaSwitch from '../AreaSwitch';
import { useComunicaTheme } from '../useComunicaTheme';
import HelpButton from './HelpSheet';

export default function SwitchField({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help?: string;
  /** `null` = nadie lo ha tocado: se pinta apagado y sigue en `null`. */
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  const t = useComunicaTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: t.text }]}>{label}</Text>
      {help ? <HelpButton label={label} text={help} /> : null}
      <View style={styles.spacer} />
      <AreaSwitch value={value === true} onChange={onChange} label={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  label: { ...typography.body, flexShrink: 1 },
  spacer: { flex: 1 },
});

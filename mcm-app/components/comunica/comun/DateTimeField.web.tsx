// En web no hay selector nativo de día ni de hora: un campo de texto con la
// forma que pide el contrato (`YYYY-MM-DD` o `HH:MM`). Ver `DateTimeField.tsx`.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AppTextField from '@/components/ui/AppTextField';
import typography from '@/constants/typography';
import { useComunicaTheme } from './useComunicaTheme';

export interface DateTimeFieldProps {
  mode: 'date' | 'time';
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export default function DateTimeField({
  mode,
  label,
  value,
  onChange,
}: DateTimeFieldProps) {
  const t = useComunicaTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: t.text }]}>{label}</Text>
      <AppTextField
        value={value}
        onChangeText={onChange}
        placeholder={mode === 'date' ? 'AAAA-MM-DD' : '19:00'}
        accessibilityLabel={label}
        accentColor={t.accentText}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 48,
  },
  label: { ...typography.body, fontWeight: '600' },
  input: { minWidth: 140 },
});

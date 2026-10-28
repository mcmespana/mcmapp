// Un campo de día o de hora del área («Día», «Empieza»): el selector del
// sistema. En iOS, el compacto en línea; en Android, el diálogo nativo al
// tocar la fila. En web hay otra versión (`DateTimeField.web.tsx`): el
// selector nativo no existe allí.
//
// El valor viaja como texto: `YYYY-MM-DD` (día) o `HH:MM` (hora), que es lo
// que pide el contrato. Se leen y se escriben en la hora del móvil.

import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { PressableFeedback } from 'heroui-native';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useColorScheme } from '@/hooks/useColorScheme';
import { longDay } from '@/utils/comunica/dates';
import { useComunicaTheme } from './useComunicaTheme';

export interface DateTimeFieldProps {
  mode: 'date' | 'time';
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function toDate(mode: 'date' | 'time', value: string): Date {
  const d = new Date();
  if (mode === 'date') {
    const [y, m, day] = value.split('-').map(Number);
    if (y && m && day) return new Date(y, m - 1, day, 12, 0, 0);
    return d;
  }
  const [h, mi] = value.split(':').map(Number);
  d.setHours(Number.isFinite(h) ? h : 19, Number.isFinite(mi) ? mi : 0, 0, 0);
  return d;
}

export function fromDate(mode: 'date' | 'time', d: Date): string {
  return mode === 'date'
    ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const shownValue = (mode: 'date' | 'time', value: string) =>
  mode === 'date' ? longDay(value) : value;

export default function DateTimeField({
  mode,
  label,
  value,
  onChange,
}: DateTimeFieldProps) {
  const t = useComunicaTheme();
  const isDark = useColorScheme() === 'dark';
  const date = toDate(mode, value);

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.row}>
        <Text style={[styles.label, { color: t.text }]}>{label}</Text>
        <DateTimePicker
          value={date}
          mode={mode}
          display="compact"
          locale="es-ES"
          minuteInterval={mode === 'time' ? 5 : undefined}
          themeVariant={isDark ? 'dark' : 'light'}
          accentColor={t.accentText}
          onChange={(_, selected) => {
            if (selected) onChange(fromDate(mode, selected));
          }}
          accessibilityLabel={label}
        />
      </View>
    );
  }

  return (
    <PressableFeedback
      onPress={() =>
        DateTimePickerAndroid.open({
          value: date,
          mode,
          is24Hour: true,
          onChange: (_, selected) => {
            if (selected) onChange(fromDate(mode, selected));
          },
        })
      }
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${shownValue(mode, value)}`}
      style={styles.row}
    >
      <PressableFeedback.Highlight />
      <Text style={[styles.label, { color: t.text }]}>{label}</Text>
      <View style={[styles.value, { backgroundColor: t.backgroundSunken }]}>
        <Text style={[styles.valueText, { color: t.accentText }]}>
          {shownValue(mode, value)}
        </Text>
      </View>
    </PressableFeedback>
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
  value: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.sm,
  },
  valueText: { ...typography.body },
});

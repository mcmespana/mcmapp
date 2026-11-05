// Una hora de un recordatorio («08:00») como pastilla del color del hábito.
// iOS: el selector compacto del sistema dentro de la pastilla. Android: la
// pastilla abre el diálogo nativo. En web hay otra versión
// (`ReminderTimeChip.web.tsx`): el selector nativo no existe allí.
//
// El valor viaja como texto `HH:MM`, en la hora del móvil.

import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { PressableFeedback } from 'heroui-native';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { MaterialIcons } from '@/components/ui/icons';

export interface ReminderTimeChipProps {
  value: string;
  /** «1.º», «2.º»… */
  ordinal: string;
  /** El color del hábito, para el tinte de fondo y el acento. */
  tint: string;
  tintBg: string;
  textColor: string;
  isDark: boolean;
  onChange: (value: string) => void;
  /** Con él, la pastilla lleva una × para quitar el aviso. */
  onRemove?: () => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

export const timeToDate = (value: string): Date => {
  const d = new Date();
  const [h, m] = value.split(':').map(Number);
  d.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
};
export const dateToTime = (d: Date): string =>
  `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export default function ReminderTimeChip({
  value,
  ordinal,
  tint,
  tintBg,
  textColor,
  isDark,
  onChange,
  onRemove,
}: ReminderTimeChipProps) {
  const label = `Aviso ${ordinal}, ${value}`;
  const date = timeToDate(value);

  const body =
    Platform.OS === 'ios' ? (
      <DateTimePicker
        value={date}
        mode="time"
        display="compact"
        locale="es-ES"
        minuteInterval={5}
        themeVariant={isDark ? 'dark' : 'light'}
        accentColor={tint}
        onChange={(_, selected) => {
          if (selected) onChange(dateToTime(selected));
        }}
        accessibilityLabel={label}
      />
    ) : (
      <PressableFeedback
        onPress={() =>
          DateTimePickerAndroid.open({
            value: date,
            mode: 'time',
            is24Hour: true,
            onChange: (_, selected) => {
              if (selected) onChange(dateToTime(selected));
            },
          })
        }
        accessibilityRole="button"
        accessibilityLabel={label}
        style={styles.timeButton}
      >
        <Text style={[styles.time, { color: textColor }]}>{value}</Text>
      </PressableFeedback>
    );

  return (
    <View style={[styles.chip, { backgroundColor: tintBg }]}>
      <Text style={[styles.ordinal, { color: tint }]}>{ordinal}</Text>
      {body}
      {onRemove ? (
        <PressableFeedback
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={`Quitar el aviso ${ordinal}`}
          hitSlop={8}
          style={styles.remove}
        >
          <MaterialIcons name="close" size={18} color={textColor} />
        </PressableFeedback>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: radii.pillFull,
  },
  ordinal: { ...typography.footnote, fontWeight: '700' },
  timeButton: {
    minHeight: 44,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  time: { ...typography.title, fontVariant: ['tabular-nums'] },
  remove: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

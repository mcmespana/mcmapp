// En web no hay selector nativo de hora: un campo de texto `HH:MM`. Ver
// `ReminderTimeChip.tsx`. Solo se guarda cuando lo escrito es una hora válida.

import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { MaterialIcons } from '@/components/ui/icons';
import { normalizeTime } from '@/utils/contigoReminders';
import type { ReminderTimeChipProps } from './ReminderTimeChip';

export default function ReminderTimeChip({
  value,
  ordinal,
  tint,
  tintBg,
  textColor,
  onChange,
  onRemove,
}: ReminderTimeChipProps) {
  // Lo que se está escribiendo mientras no sea una hora válida; al salir del
  // campo se vuelve al valor guardado.
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <View style={[styles.chip, { backgroundColor: tintBg }]}>
      <Text style={[styles.ordinal, { color: tint }]}>{ordinal}</Text>
      <TextInput
        value={draft ?? value}
        onChangeText={(t) => {
          setDraft(t);
          const n = normalizeTime(t);
          if (n) onChange(n);
        }}
        onBlur={() => setDraft(null)}
        placeholder="08:00"
        maxLength={5}
        accessibilityLabel={`Aviso ${ordinal}`}
        style={[styles.input, { color: textColor }]}
      />
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
  input: { ...typography.title, width: 64, textAlign: 'center' },
  remove: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

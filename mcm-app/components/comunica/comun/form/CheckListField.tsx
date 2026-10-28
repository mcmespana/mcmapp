// Un desplegable múltiple del plugin (`multienum`) como lista de casillas:
// una fila por opción, de 48 pt, con su marca. Las claves que el servidor ya
// no ofrece se conservan (no se ven, pero no se borran).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { h } from '@/utils/haptics';
import { useComunicaTheme } from '../useComunicaTheme';
import { FieldLabel } from './FormField';

export default function CheckListField({
  label,
  help,
  options,
  value,
  onChange,
}: {
  label: string;
  help?: string;
  options: readonly { value: string; label: string }[];
  value: readonly string[];
  onChange: (v: string[]) => void;
}) {
  const t = useComunicaTheme();
  const toggle = (k: string) => {
    h.toggle();
    onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  };
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <FieldLabel label={label} help={help} />
      </View>
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <PressableFeedback
            key={o.value}
            onPress={() => toggle(o.value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={o.label}
            style={styles.option}
          >
            <PressableFeedback.Highlight />
            <IconSymbol
              name={on ? 'checkmark.circle.fill' : 'circle'}
              size={22}
              color={on ? t.accentText : t.textMuted}
            />
            <Text style={[styles.optionLabel, { color: t.text }]}>
              {o.label}
            </Text>
          </PressableFeedback>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 6 },
  head: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  optionLabel: { ...typography.body, flex: 1 },
});

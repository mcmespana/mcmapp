// Un desplegable (plan 09, regla 4): una fila con la etiqueta y el valor que,
// al tocarla, abre una hoja con las opciones. La primera es «Sin indicar»
// (`null`), como la opción vacía del motor del plugin: se puede volver a
// ella, y no es lo mismo que «No».

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { h } from '@/utils/haptics';
import { useComunicaTheme } from '../useComunicaTheme';
import HelpButton from './HelpSheet';

export const UNSET_LABEL = 'Sin indicar';

export interface SelectOption<V extends string> {
  value: V;
  label: string;
}

export default function SelectField<V extends string>({
  label,
  help,
  value,
  options,
  onChange,
}: {
  label: string;
  help?: string;
  value: V | null;
  options: readonly SelectOption<V>[];
  onChange: (v: V | null) => void;
}) {
  const t = useComunicaTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  // Un valor que el servidor ya no ofrece se enseña tal cual (no se pierde).
  const shown = current?.label ?? value ?? UNSET_LABEL;
  const choose = (v: V | null) => {
    h.select();
    setOpen(false);
    if (v !== value) onChange(v);
  };
  return (
    <>
      <PressableFeedback
        onPress={() => {
          h.tap();
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${shown}`}
        accessibilityHint="Abre las opciones"
        style={styles.row}
      >
        <Text style={[styles.label, { color: t.text }]}>{label}</Text>
        {/* La ⓘ es su propio botón, dentro de la fila (gana el toque). */}
        {help ? <HelpButton label={label} text={help} /> : null}
        <Text
          style={[
            styles.value,
            { color: value === null ? t.textMuted : t.textSecondary },
          ]}
          numberOfLines={2}
        >
          {shown}
        </Text>
        <IconSymbol name="chevron.down" size={14} color={t.textMuted} />
        {/* Al final: en web, delante, el hueco (`gap`) movía el contenido. */}
        <PressableFeedback.Highlight />
      </PressableFeedback>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={label}>
        <View
          style={[styles.list, { backgroundColor: t.card }]}
          accessibilityRole="radiogroup"
        >
          {[{ value: null, label: UNSET_LABEL }, ...options].map((o, i) => {
            const selected = o.value === value;
            return (
              <PressableFeedback
                key={o.value ?? '∅'}
                onPress={() => choose(o.value as V | null)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={o.label}
                style={[
                  styles.option,
                  i > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: t.separator,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.optionLabel,
                    {
                      color:
                        o.value === null && !selected
                          ? t.textSecondary
                          : t.text,
                    },
                    selected && styles.optionSelected,
                  ]}
                >
                  {o.label}
                </Text>
                {selected ? (
                  <IconSymbol name="checkmark" size={18} color={t.accentText} />
                ) : null}
                <PressableFeedback.Highlight />
              </PressableFeedback>
            );
          })}
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  label: { ...typography.body, flexShrink: 1 },
  value: { ...typography.body, flex: 1, textAlign: 'right' },
  list: { borderRadius: radii.md, overflow: 'hidden', marginBottom: 16 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  optionLabel: { ...typography.body, flex: 1 },
  optionSelected: { fontWeight: '600' },
});

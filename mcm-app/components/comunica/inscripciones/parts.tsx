// Las piezas del alta corta y de modificar (plan 14): un grupo de opciones con papel de radio, las necesidades especiales y el resumen del evento.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import type { SpecialNeedsDef } from '@/services/comunica/contract';
import { h } from '@/utils/haptics';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { FieldHint, TextFormField } from '../comun/form/FormField';
import FormSection from '../comun/form/FormSection';

type IconName = React.ComponentProps<typeof IconSymbol>['name'];

export interface Choice<V extends string | number> {
  value: V;
  label: string;
  icon?: IconName;
  note?: string;
}

/** Un grupo de opciones obligatorio: cada una es una fila entera pulsable con `accessibilityRole="radio"`. */
export function ChoiceGroup<V extends string | number>({
  title,
  options,
  value,
  onChange,
  error,
}: {
  title: string;
  options: readonly Choice<V>[];
  value: V | null | undefined;
  onChange: (v: V) => void;
  error?: string;
}) {
  const t = useComunicaTheme();
  return (
    <View style={styles.group}>
      <Text
        accessibilityRole="header"
        style={[styles.groupTitle, { color: t.text }]}
      >
        {title}
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={title}
        style={styles.options}
      >
        {options.map((o) => {
          const on = o.value === value;
          return (
            <PressableFeedback
              key={String(o.value)}
              onPress={() => {
                h.select();
                onChange(o.value);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={o.note ? `${o.label}. ${o.note}` : o.label}
              style={[
                styles.option,
                shadows.card,
                {
                  backgroundColor: on ? t.backgroundSunken : t.card,
                  borderColor: on ? t.accentFill : 'transparent',
                },
              ]}
            >
              {o.icon ? (
                <IconSymbol name={o.icon} size={20} color={t.textSecondary} />
              ) : null}
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, { color: t.text }]}>
                  {o.label}
                </Text>
                {o.note ? (
                  <Text style={[styles.optionNote, { color: t.textSecondary }]}>
                    {o.note}
                  </Text>
                ) : null}
              </View>
              <IconSymbol
                name={on ? 'checkmark.circle.fill' : 'circle'}
                size={22}
                color={on ? t.accentFill : t.textSecondary}
              />
            </PressableFeedback>
          );
        })}
      </View>
      <FieldHint error={error} />
    </View>
  );
}

/** Necesidades especiales: con la etiqueta del CRM; la descripción solo con la opción «sí» (`yesValue`). */
export function SpecialNeedsField({
  def,
  value,
  description,
  onValue,
  onDescription,
}: {
  def: SpecialNeedsDef;
  value: string | null;
  description: string;
  onValue: (v: string) => void;
  onDescription: (v: string) => void;
}) {
  if (def.options.length === 0) return null;
  return (
    <FormSection title={def.label}>
      <View style={styles.inner}>
        <ChoiceGroup
          title={def.label}
          options={def.options.map((o) => ({ value: o.value, label: o.label }))}
          value={value}
          onChange={onValue}
        />
      </View>
      {value === def.yesValue ? (
        <TextFormField
          label={def.descriptionLabel}
          value={description}
          onChangeText={onDescription}
          multiline
          maxLength={255}
        />
      ) : null}
    </FormSection>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  groupTitle: { ...typography.title },
  options: { gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1.5,
  },
  optionText: { flex: 1 },
  optionLabel: { ...typography.body },
  optionNote: { ...typography.caption },
  inner: { padding: 16 },
});

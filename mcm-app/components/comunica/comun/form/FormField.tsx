// Un campo de formulario del área (plan 09): etiqueta, ayuda ⓘ, el control,
// y debajo la pista gris o el error. Vive dentro de una `FormSection` (una
// fila de su tarjeta). `TextFormField` es el caso de texto, con
// `AppTextField` (`design.md` §7).

import React from 'react';
import { StyleSheet, Text, View, type TextInputProps } from 'react-native';
import AppTextField from '@/components/ui/AppTextField';
import typography from '@/constants/typography';
import { useComunicaTheme } from '../useComunicaTheme';
import HelpButton from './HelpSheet';

export interface FieldProps {
  label: string;
  /** El texto de la ⓘ (el `help` del plugin). */
  help?: string;
  /** La línea gris de debajo (el `hint` del plugin). */
  hint?: string;
  /** Si lo hay, sustituye a la pista, en rojo. */
  error?: string;
}

export default function FormField({
  label,
  help,
  hint,
  error,
  children,
}: FieldProps & { children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <FieldLabel label={label} help={help} />
      {children}
      <FieldHint hint={hint} error={error} />
    </View>
  );
}

export function FieldLabel({ label, help }: { label: string; help?: string }) {
  const t = useComunicaTheme();
  return (
    <View style={styles.labelRow}>
      <Text style={[styles.label, { color: t.text }]}>{label}</Text>
      {help ? <HelpButton label={label} text={help} /> : null}
    </View>
  );
}

export function FieldHint({ hint, error }: { hint?: string; error?: string }) {
  const t = useComunicaTheme();
  if (error) {
    return (
      <Text
        style={[styles.hint, { color: t.dangerText }]}
        accessibilityRole="alert"
      >
        {error}
      </Text>
    );
  }
  return hint ? (
    <Text style={[styles.hint, { color: t.textSecondary }]}>{hint}</Text>
  ) : null;
}

/** Un campo de texto: etiqueta arriba y `AppTextField` debajo. */
export function TextFormField({
  label,
  help,
  hint,
  error,
  value,
  onChangeText,
  inline,
  ...input
}: FieldProps &
  Omit<TextInputProps, 'value' | 'onChangeText'> & {
    value: string;
    onChangeText: (v: string) => void;
    /** Etiqueta a la izquierda y el campo corto a la derecha (un año). */
    inline?: boolean;
  }) {
  const t = useComunicaTheme();
  if (inline) {
    return (
      <View style={styles.inlineField}>
        <View style={styles.inlineRow}>
          <View style={styles.inlineLabel}>
            <FieldLabel label={label} help={help} />
          </View>
          <AppTextField
            value={value}
            onChangeText={onChangeText}
            accessibilityLabel={label}
            accessibilityHint={error ?? hint}
            accentColor={t.accentText}
            error={!!error}
            style={styles.inlineInput}
            {...input}
          />
        </View>
        <FieldHint hint={hint} error={error} />
      </View>
    );
  }
  return (
    <FormField label={label} help={help} hint={hint} error={error}>
      <AppTextField
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        accentColor={t.accentText}
        error={!!error}
        {...input}
      />
    </FormField>
  );
}

const styles = StyleSheet.create({
  field: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { ...typography.body, flexShrink: 1 },
  hint: { ...typography.caption },
  inlineField: { paddingHorizontal: 16, paddingVertical: 8, gap: 4 },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inlineLabel: { flex: 1 },
  // Cabe «AAAA» con la letra grande; el número va alineado como en Ajustes.
  inlineInput: { width: 96, textAlign: 'center' },
});

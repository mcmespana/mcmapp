import React, { forwardRef, useState } from 'react';
import { TextInput, TextInputProps, StyleSheet, Platform } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';

/**
 * Campo de texto unificado (Fase 2 de PLAN_UI_NATIVA).
 *
 * Encapsula el patrón que se repetía a mano en ~14 modales/pantallas: input
 * redondeado, fondo adaptado al tema, texto del tema, borde neutro que se
 * resalta (verde Apple) al enfocar o al tener contenido. Reenvía todas las
 * props de `TextInput` (placeholder, value, multiline, keyboardType, maxLength,
 * autoFocus, etc.), así que es un reemplazo directo.
 */
interface AppTextFieldProps extends TextInputProps {
  /** Borde verde cuando el campo tiene contenido (además de al enfocar). */
  accentWhenFilled?: boolean;
}

const ACCENT = '#34C759'; // verde "completado" de iOS

const AppTextField = forwardRef<TextInput, AppTextFieldProps>(
  function AppTextField(
    { style, accentWhenFilled, value, multiline, onFocus, onBlur, ...rest },
    ref,
  ) {
    const isDark = useColorScheme() === 'dark';
    const [focused, setFocused] = useState(false);
    const theme = Colors[isDark ? 'dark' : 'light'];

    const bg = isDark ? '#2C2C2E' : '#F2F2F7';
    const neutralBorder = isDark ? '#3A3A3C' : '#E5E5EA';
    const filled = accentWhenFilled && !!(value && String(value).trim());
    const borderColor = focused || filled ? ACCENT : neutralBorder;

    return (
      <TextInput
        ref={ref}
        value={value}
        multiline={multiline}
        placeholderTextColor={isDark ? '#8E8E93' : '#9A9A9E'}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.base,
          { backgroundColor: bg, color: theme.text, borderColor },
          multiline && styles.multiline,
          style,
        ]}
        {...rest}
      />
    );
  },
);

export default AppTextField;

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    fontSize: 16,
  },
  multiline: {
    minHeight: 96,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
});

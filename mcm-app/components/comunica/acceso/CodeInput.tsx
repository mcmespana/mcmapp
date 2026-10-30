// Seis casillas para el código. Un solo `TextInput` transparente encima de las
// casillas: así funciona igual en iOS, Android y web, el autocompletado del
// código del correo entra de golpe (`oneTimeCode` / `one-time-code`) y pegar
// también. (El `InputOTP` de heroui no pintaba las casillas en web.)

import React, { forwardRef } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import typography from '@/constants/typography';
import { focusRing, radii } from '@/constants/uiStyles';
import { useComunicaTheme } from '../comun/useComunicaTheme';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
}

const CodeInput = forwardRef<TextInput, Props>(function CodeInput(
  { value, onChange, onComplete, length = 6, disabled, invalid },
  ref,
) {
  const t = useComunicaTheme();
  const [focused, setFocused] = React.useState(false);
  const digits = value.split('');
  const active = Math.min(value.length, length - 1);

  return (
    <View style={styles.wrap}>
      <View style={styles.row} pointerEvents="none">
        {Array.from({ length }, (_, i) => {
          const isActive = focused && i === active;
          return (
            <View
              key={i}
              style={[
                styles.box,
                {
                  backgroundColor: t.backgroundSunken,
                  // El borde es el FOCO (y el error): en las demás casillas,
                  // transparente. Siempre del mismo grosor, para no moverlas.
                  borderColor: invalid
                    ? t.warningIcon
                    : isActive
                      ? t.accentText
                      : 'transparent',
                },
              ]}
            >
              <Text style={[styles.digit, { color: t.text }]}>
                {digits[i] ?? ''}
              </Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(raw) => {
          const v = raw.replace(/\D/g, '').slice(0, length);
          onChange(v);
          if (v.length === length) onComplete?.(v);
        }}
        editable={!disabled}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        maxLength={length}
        autoFocus
        caretHidden
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={`Código de ${length} cifras`}
        style={styles.input}
      />
    </View>
  );
});

export default CodeInput;

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  row: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  box: {
    flex: 1,
    aspectRatio: 0.85,
    maxWidth: 56,
    borderRadius: radii.md,
    borderWidth: focusRing.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { ...typography.h1 },
  input: {
    ...StyleSheet.absoluteFill,
    ...typography.body,
    opacity: 0.02,
    color: 'transparent',
  },
});

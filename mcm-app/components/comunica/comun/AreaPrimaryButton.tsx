// La acción principal de una pantalla del área («Recibir código», «Registrar
// el aviso», «Guardar lista»…), con el degradado de marca de Comunica
// (territorio «Comunica», plan 03 §2). UNO por pantalla: es la firma del área,
// como en la web, y la única superficie del área que lleva degradado (lo vigila
// `__tests__/comunica/territorio.test.ts`).
//
// La forma y el comportamiento son los de `AppPrimaryButton` (el CTA aprobado,
// `design.md` §7): `PressableFeedback` con `Scale`, háptica, spinner al
// cargar, gris cuando está deshabilitado y anillo de foco de 2 px que no
// mueve el botón. Lo único que cambia es el relleno, y por eso no se puede
// envolver aquel: su relleno es un color plano y el degradado tiene que
// escalar con la pulsación.

import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { focusRing, radii } from '@/constants/uiStyles';
import { h } from '@/utils/haptics';
import { BRAND_GRADIENT } from './theme';
import { useComunicaTheme } from './useComunicaTheme';

type IconName = React.ComponentProps<typeof IconSymbol>['name'];

interface Props {
  label: string;
  onPress: () => void;
  /** Icono (SF Symbols / Material) delante del texto. */
  icon?: IconName;
  disabled?: boolean;
  /** Spinner y sin pulsación. */
  loading?: boolean;
  /** Háptica al pulsar (por defecto sí). */
  haptic?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export default function AreaPrimaryButton({
  label,
  onPress,
  icon,
  disabled = false,
  loading = false,
  haptic = true,
  style,
  accessibilityLabel,
}: Props) {
  const t = useComunicaTheme();
  const isDisabled = disabled || loading;
  const [focused, setFocused] = React.useState(false);
  const fg = isDisabled ? t.icon : t.onGradient;

  return (
    <PressableFeedback
      onPress={() => {
        if (isDisabled) return;
        if (haptic) h.tap();
        onPress();
      }}
      isDisabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.button,
        isDisabled && { backgroundColor: t.separator },
        focused && { borderColor: fg },
        style,
      ]}
    >
      {isDisabled ? null : (
        <LinearGradient
          testID="area-primary-gradient"
          colors={BRAND_GRADIENT}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      <PressableFeedback.Scale />
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : icon ? (
        <IconSymbol name={icon} size={18} color={fg} />
      ) : null}
      <View style={styles.labelWrap}>
        <Text style={[styles.label, { color: fg }]}>{label}</Text>
      </View>
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radii.md,
    borderWidth: focusRing.borderWidth,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  labelWrap: { flexShrink: 1 },
  label: { ...typography.body, fontWeight: '700', textAlign: 'center' },
});

// Una acción SECUNDARIA del área («Cambiar forma de pago», «Reintentar»): el mismo contorno que «Pagar con tarjeta» de una tarjeta de pago (pastilla con borde
// en el acento, sin relleno ni degradado). La principal es `AreaPrimaryButton` y solo hay una por pantalla; esta es la que no compite con ella.

import React from 'react';
import { StyleSheet, Text, type ViewStyle } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { h } from '@/utils/haptics';
import { useComunicaTheme } from './useComunicaTheme';

type IconName = React.ComponentProps<typeof IconSymbol>['name'];

export default function AreaSecondaryButton({
  label,
  onPress,
  icon,
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  const t = useComunicaTheme();
  return (
    <PressableFeedback
      onPress={() => {
        h.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.button, { borderColor: t.accentText }, style]}
    >
      {icon ? <IconSymbol name={icon} size={18} color={t.accentText} /> : null}
      <Text style={[styles.label, { color: t.accentText }]}>{label}</Text>
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    borderWidth: 1.5,
    borderRadius: radii.pillFull,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  label: { ...typography.button },
});

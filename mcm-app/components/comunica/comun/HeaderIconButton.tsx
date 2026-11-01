// Un icono en la cabecera nativa («Subir» en Documentos, «Compartir» en el
// visor; plan 16). 44 × 44 de toque y la tinta de la cabecera (regla 13 de
// AREA_NATIVA_DISENO): la del sistema en iOS, blanco sobre la barra violeta
// en Android y web.

import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { h } from '@/utils/haptics';
import { useComunicaTheme } from './useComunicaTheme';

export default function HeaderIconButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: React.ComponentProps<typeof IconSymbol>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const t = useComunicaTheme();
  const tint = Platform.OS === 'ios' ? t.headerTint : '#fff';
  return (
    <PressableFeedback
      onPress={() => {
        h.tap();
        onPress();
      }}
      isDisabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={8}
      style={[styles.button, disabled && styles.disabled]}
    >
      <IconSymbol name={icon} size={22} color={tint} />
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
});

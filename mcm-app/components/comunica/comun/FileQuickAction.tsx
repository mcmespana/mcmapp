// El botón redondo de 44 pt para abrir un archivo a un toque (plan 16; la
// descarga rápida de `sticpa_documents_list_html`). Va HERMANO de la tarjeta,
// nunca dentro: tocar la tarjeta abre la ficha, y bajar un archivo sin
// querer es de lo que más molesta en un móvil. Mientras baja, la rueda.

import React from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { radii } from '@/constants/uiStyles';
import { useComunicaTheme } from './useComunicaTheme';

export default function FileQuickAction({
  label,
  busy = false,
  disabled = false,
  onPress,
}: {
  /** «Abrir Autorización de imagen», para el lector. */
  label: string;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const t = useComunicaTheme();
  const off = disabled || busy;
  return (
    <PressableFeedback
      onPress={onPress}
      isDisabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy }}
      hitSlop={4}
      style={[styles.button, { backgroundColor: t.backgroundSunken }]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={t.accentText} />
      ) : (
        <IconSymbol
          name="tray.and.arrow.down"
          size={20}
          color={disabled ? t.textMuted : t.accentText}
        />
      )}
      <PressableFeedback.Highlight />
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

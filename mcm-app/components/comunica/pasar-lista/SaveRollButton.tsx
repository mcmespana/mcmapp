// El botón principal de marcar: «Guardar lista», «Guardar (N sin marcar)»,
// «Guardada ✓» o «Aún no ha llegado». Vive aquí SOLO, para cambiarlo en un
// sitio cuando llegue la acción principal del territorio Comunica (degradado
// de marca, decisión `territorio`).

import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useComunicaTheme } from '../comun/useComunicaTheme';

export default function SaveRollButton({
  label,
  enabled,
  onPress,
}: {
  label: string;
  enabled: boolean;
  onPress: () => void;
}) {
  const t = useComunicaTheme();
  return (
    <PressableFeedback
      isDisabled={!enabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      style={[
        styles.save,
        { backgroundColor: enabled ? t.accentFill : t.separator },
      ]}
    >
      <PressableFeedback.Scale />
      <Text
        style={[
          styles.saveLabel,
          { color: enabled ? t.onAccent : t.textSecondary },
        ]}
      >
        {label}
      </Text>
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  save: {
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLabel: { ...typography.button },
});

// Las piezas pequeñas de una pantalla de marcar, las MISMAS en la lista de un
// grupo (plan 04) y en la de un evento (plan 07):
//
//   · `Notice`: el aviso con icono de encima de la lista («Es la sesión de
//     ayer», «Este evento no tiene días en el CRM…»).
//   · `FillButton`: «Han venido todos» / «Están todos»: solo rellena lo sin
//     marcar.
//   · `Count`: un recuento de la barra de guardar, con el icono de su marca.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import type { Mark } from '@/services/comunica/contract';
import { h } from '@/utils/haptics';
import { MarkIcon } from '../comun/MarkControl';
import { useComunicaTheme } from '../comun/useComunicaTheme';

export function Notice({
  icon,
  text,
  tone = 'warning',
}: {
  icon: 'clock' | 'exclamationmark.triangle.fill' | 'calendar';
  text: string;
  /** `info`: lo que hay que saber pero no es un problema. */
  tone?: 'warning' | 'info';
}) {
  const t = useComunicaTheme();
  const warning = tone === 'warning';
  return (
    <View style={styles.notice}>
      <IconSymbol
        name={icon}
        size={16}
        color={warning ? t.warningIcon : t.accentText}
      />
      <Text
        style={[
          styles.noticeText,
          { color: warning ? t.warningText : t.textSecondary },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

export function FillButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const t = useComunicaTheme();
  return (
    <PressableFeedback
      onPress={() => {
        h.add();
        onPress();
      }}
      isDisabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[
        styles.fill,
        { backgroundColor: t.chip('positive').background },
        disabled && styles.disabled,
      ]}
    >
      <PressableFeedback.Scale />
      <IconSymbol name="checkmark" size={18} color={t.text} />
      <Text style={[styles.fillLabel, { color: t.text }]}>{label}</Text>
    </PressableFeedback>
  );
}

export function Count({
  label,
  mark,
  warn,
}: {
  label: string;
  mark: Mark;
  warn?: boolean;
}) {
  const t = useComunicaTheme();
  return (
    <View style={styles.count}>
      <MarkIcon mark={mark} size={14} />
      <Text
        style={[styles.countText, { color: warn ? t.warningText : t.text }]}
      >
        {label}
      </Text>
    </View>
  );
}

export function Counts({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.counts} accessibilityLiveRegion="polite">
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noticeText: { ...typography.caption, flex: 1 },
  fill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: radii.md,
  },
  fillLabel: { ...typography.button },
  disabled: { opacity: 0.5 },
  counts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  count: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  countText: { ...typography.caption, fontWeight: '600' },
});

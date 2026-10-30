// Una fila que lleva a otra pantalla del área (la portada «Hoy», Coordinación):
// icono o punto de color, título, la línea que dice lo que hay y, a la
// derecha, un dato corto y el chevrón. Toda la fila se toca.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useComunicaTheme } from './useComunicaTheme';

export type NavIcon = React.ComponentProps<typeof IconSymbol>['name'];

export default function NavRow({
  title,
  subtitle,
  trailing,
  dot,
  icon,
  muted,
  onPress,
}: {
  title: string;
  subtitle?: string;
  trailing?: string;
  dot?: string;
  icon?: NavIcon;
  /** La línea de debajo en gris claro («sin pasar»). */
  muted?: boolean;
  onPress?: () => void;
}) {
  const t = useComunicaTheme();
  const label = [title, subtitle, trailing].filter(Boolean).join(', ');
  return (
    <PressableFeedback
      onPress={onPress}
      isDisabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.row}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      {icon ? <IconSymbol name={icon} size={20} color={t.accentText} /> : null}
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: t.text }]}>{title}</Text>
        {subtitle ? (
          <Text
            style={[
              styles.rowSub,
              { color: muted ? t.textMuted : t.textSecondary },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? (
        <Text style={[styles.rowSub, { color: t.textSecondary }]}>
          {trailing}
        </Text>
      ) : null}
      <IconSymbol name="chevron.right" size={16} color={t.textMuted} />
      <PressableFeedback.Highlight />
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { ...typography.body, fontWeight: '600' },
  rowSub: { ...typography.caption },
  dot: { width: 10, height: 10, borderRadius: radii.pillFull },
});

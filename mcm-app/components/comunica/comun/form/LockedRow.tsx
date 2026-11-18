// Un dato que aquí no se edita, pintado COMO DATO y no como un control
// apagado (plugin `design.md` §6.5): «Ya subido», con su marca y, al lado, a
// dónde ir para verlo («Revisarlo en Documentos ›», con el chevrón como
// icono y no como carácter: AREA_NATIVA_DISENO §2.5).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { MARK_FILL } from '../theme';
import { useComunicaTheme } from '../useComunicaTheme';

type IconName = React.ComponentProps<typeof IconSymbol>['name'];

export default function LockedRow({
  value,
  icon = 'checkmark.seal.fill',
  action,
}: {
  value: string;
  icon?: IconName;
  action?: { label: string; onPress: () => void };
}) {
  const t = useComunicaTheme();
  return (
    <View style={styles.row}>
      <View
        style={styles.value}
        accessible
        accessibilityLabel={value}
        accessibilityRole="text"
      >
        <IconSymbol name={icon} size={18} color={MARK_FILL.yes} />
        <Text style={[styles.valueText, { color: t.text }]}>{value}</Text>
      </View>
      {action ? (
        <PressableFeedback
          onPress={action.onPress}
          accessibilityRole="link"
          accessibilityLabel={action.label}
          style={styles.action}
        >
          <View style={styles.actionRow}>
            <Text style={[styles.actionText, { color: t.accentText }]}>
              {action.label}
            </Text>
            <IconSymbol name="chevron.right" size={14} color={t.accentText} />
          </View>
        </PressableFeedback>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: 12,
  },
  value: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  valueText: { ...typography.subhead, fontWeight: '600' },
  action: { minHeight: 44, justifyContent: 'center' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionText: { ...typography.subhead, fontWeight: '600' },
});

// La cabecera de una ficha de registro (`stic-record-view.php` 383-410): el
// título va en el CONTENIDO (la cabecera nativa queda con atrás y compartir),
// debajo el lema si lo hay, la fecha y el chip de estado. La comparten las
// fichas de familias (planes 13, 14, 15 y 16).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import StatusChip from '../StatusChip';
import type { ChipTone } from '../theme';
import { useComunicaTheme } from '../useComunicaTheme';

interface Props {
  title: string;
  subtitle?: string | null;
  /** «del 1 al 10 de julio de 2026». */
  dateLine?: string | null;
  chip?: { label: string; tone: ChipTone } | null;
}

export default function RecordHero({ title, subtitle, dateLine, chip }: Props) {
  const t = useComunicaTheme();
  return (
    <View style={styles.wrap}>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: t.text }]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: t.textSecondary }]}>
          {subtitle}
        </Text>
      ) : null}
      {dateLine ? (
        <View style={styles.meta}>
          <IconSymbol name="calendar" size={16} color={t.textSecondary} />
          <Text style={[styles.metaText, { color: t.textSecondary }]}>
            {dateLine}
          </Text>
        </View>
      ) : null}
      {chip ? <StatusChip label={chip.label} tone={chip.tone} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  title: { ...typography.h1 },
  subtitle: { ...typography.body },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { ...typography.subhead, flexShrink: 1 },
});

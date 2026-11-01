// Las actividades de un día (C6, el patrón móvil del 022: puntitos arriba,
// la lista del día debajo): «Martes, 14 de octubre» y una fila por actividad
// (punto, nombre, «17:30 · {evento} · {estado}» o «Todo el día · …»,
// chevron), o «No hay actividades este día».

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { radii, shadows } from '@/constants/uiStyles';
import typography from '@/constants/typography';
import {
  type CalendarItem,
  dayTitle,
  itemLine,
} from '@/utils/comunica/calendar';
import { h } from '@/utils/haptics';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { calendarFill } from './calendarColors';

export function ItemRow({
  item,
  first,
  onPress,
}: {
  item: CalendarItem;
  first: boolean;
  onPress: (item: CalendarItem) => void;
}) {
  const t = useComunicaTheme();
  const line = itemLine(item);
  return (
    <PressableFeedback
      onPress={() => {
        h.tap();
        onPress(item);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${line}`}
      style={[
        styles.row,
        !first && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: t.separator,
        },
      ]}
    >
      <View
        style={[
          styles.dot,
          { backgroundColor: calendarFill(item.bucket, t.isDark) },
        ]}
      />
      <View style={styles.body}>
        <Text style={[styles.title, { color: t.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text
          style={[styles.sub, { color: t.textSecondary }]}
          numberOfLines={2}
        >
          {line}
        </Text>
      </View>
      <IconSymbol name="chevron.right" size={16} color={t.textMuted} />
      <PressableFeedback.Highlight />
    </PressableFeedback>
  );
}

export default function DayList({
  day,
  items,
  onPress,
  showTitle = true,
}: {
  day: string;
  items: readonly CalendarItem[];
  onPress: (item: CalendarItem) => void;
  showTitle?: boolean;
}) {
  const t = useComunicaTheme();
  return (
    <View style={styles.wrap}>
      {showTitle ? (
        <Text
          accessibilityRole="header"
          style={[styles.dayTitle, { color: t.text }]}
        >
          {dayTitle(day)}
        </Text>
      ) : null}
      {items.length === 0 ? (
        <Text style={[styles.empty, { color: t.textSecondary }]}>
          No hay actividades este día
        </Text>
      ) : (
        <View style={[styles.card, shadows.card, { backgroundColor: t.card }]}>
          {items.map((it, i) => (
            <ItemRow
              key={`${it.kind}-${it.id}`}
              item={it}
              first={i === 0}
              onPress={onPress}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  dayTitle: { ...typography.h3, paddingHorizontal: 4 },
  empty: { ...typography.body, paddingHorizontal: 4 },
  card: { borderRadius: radii.lg, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dot: { width: 10, height: 10, borderRadius: radii.pillFull },
  body: { flex: 1, gap: 2 },
  title: { ...typography.body, fontWeight: '600' },
  sub: { ...typography.caption },
});

// Las piezas del calendario (plan 16): la rejilla del mes con puntitos, la lista del día, la leyenda y la agenda. Colores solo de `theme.ts`, nunca un hex.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import {
  dayLabel,
  dayTitle,
  dotsOf,
  itemLine,
  itemTone,
  LEGEND,
  monthWeeks,
  WEEKDAYS_SHORT,
  type DayItem,
  type Tone,
} from '@/utils/comunica/calendar';
import { h } from '@/utils/haptics';
import { MARK_FILL } from '../comun/theme';
import { useComunicaTheme } from '../comun/useComunicaTheme';

/** El color sólido de un puntito: asistió, no asistió, próxima (informativo), sin registrar (neutro), abierto (el acento) y con plaza. */
export function useToneColor() {
  const t = useComunicaTheme();
  return (tone: Tone): string =>
    tone === 'positive'
      ? MARK_FILL.yes
      : tone === 'negative'
        ? MARK_FILL.no_unjustified
        : tone === 'info'
          ? MARK_FILL.partial
          : tone === 'accent'
            ? t.accentFill
            : t.textSecondary;
}

export function MonthGrid({
  month,
  today,
  selected,
  items,
  onSelect,
}: {
  month: string;
  today: string;
  selected: string;
  items: Map<string, DayItem[]>;
  onSelect: (day: string) => void;
}) {
  const t = useComunicaTheme();
  const color = useToneColor();
  return (
    <View style={[styles.grid, shadows.card, { backgroundColor: t.card }]}>
      <View style={styles.week}>
        {WEEKDAYS_SHORT.map((w) => (
          <Text
            key={w}
            style={[styles.weekday, { color: t.textSecondary }]}
            accessible={false}
          >
            {w}
          </Text>
        ))}
      </View>
      {monthWeeks(month).map((week, i) => (
        <View key={i} style={styles.week}>
          {week.map((day, j) => {
            if (!day) return <View key={j} style={styles.cell} />;
            const list = items.get(day) ?? [];
            const isSelected = day === selected;
            const isToday = day === today;
            return (
              <PressableFeedback
                key={day}
                onPress={() => {
                  h.select();
                  onSelect(day);
                }}
                accessibilityRole="button"
                accessibilityLabel={dayLabel(day, list.length)}
                accessibilityState={{ selected: isSelected }}
                style={[
                  styles.cell,
                  isSelected && {
                    backgroundColor: t.accentFill,
                    borderRadius: radii.md,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dayNumber,
                    { color: isSelected ? t.onAccent : t.text },
                    isToday &&
                      !isSelected && { color: t.accentText, fontWeight: '700' },
                  ]}
                >
                  {Number(day.slice(8))}
                </Text>
                <View style={styles.dots}>
                  {dotsOf(list).map((tone, k) => (
                    <View
                      key={k}
                      style={[styles.dot, { backgroundColor: color(tone) }]}
                    />
                  ))}
                </View>
              </PressableFeedback>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function Legend() {
  const t = useComunicaTheme();
  const color = useToneColor();
  return (
    <View style={styles.legend} accessibilityLabel="Leyenda del calendario">
      {LEGEND.map((l) => (
        <View key={l.key} style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: color(l.tone) }]} />
          <Text style={[styles.legendText, { color: t.textSecondary }]}>
            {l.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function DayRow({
  item,
  onPress,
}: {
  item: DayItem;
  onPress: () => void;
}) {
  const t = useComunicaTheme();
  const color = useToneColor();
  return (
    <PressableFeedback
      onPress={() => {
        h.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}. ${itemLine(item)}`}
      style={[styles.row, shadows.card, { backgroundColor: t.card }]}
    >
      <View
        style={[
          styles.dot,
          styles.rowDot,
          { backgroundColor: color(itemTone(item)) },
        ]}
      />
      <View style={styles.rowMain}>
        <Text style={[styles.rowTitle, { color: t.text }]} numberOfLines={2}>
          {item.name}
        </Text>
        <Text
          style={[styles.rowLine, { color: t.textSecondary }]}
          numberOfLines={2}
        >
          {itemLine(item)}
        </Text>
      </View>
      <IconSymbol name="chevron.right" size={16} color={t.textSecondary} />
    </PressableFeedback>
  );
}

/** La lista del día: «Martes, 14 de octubre» y una fila por actividad, o «No hay actividades este día». */
export function DayList({
  day,
  items,
  empty,
  onOpen,
}: {
  day: string;
  items: DayItem[];
  empty: string;
  onOpen: (i: DayItem) => void;
}) {
  const t = useComunicaTheme();
  return (
    <View style={styles.dayList}>
      <Text
        accessibilityRole="header"
        style={[styles.dayTitle, { color: t.text }]}
      >
        {dayTitle(day)}
      </Text>
      {items.length === 0 ? (
        <Text style={[styles.empty, { color: t.textSecondary }]}>{empty}</Text>
      ) : (
        items.map((i, k) => (
          <DayRow
            key={`${i.kind}-${i.id}-${k}`}
            item={i}
            onPress={() => onOpen(i)}
          />
        ))
      )}
    </View>
  );
}

export function AgendaList({
  days,
  empty,
  onOpen,
}: {
  days: { day: string; items: DayItem[] }[];
  empty: string;
  onOpen: (i: DayItem) => void;
}) {
  const t = useComunicaTheme();
  if (days.length === 0)
    return (
      <Text style={[styles.empty, { color: t.textSecondary }]}>{empty}</Text>
    );
  return (
    <View style={styles.dayList}>
      {days.map((d) => (
        <DayList
          key={d.day}
          day={d.day}
          items={d.items}
          empty=""
          onOpen={onOpen}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { borderRadius: radii.lg, padding: 8, gap: 2 },
  week: { flexDirection: 'row' },
  weekday: {
    ...typography.caption,
    flex: 1,
    textAlign: 'center',
    paddingVertical: 4,
  },
  cell: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dayNumber: { ...typography.body },
  dots: { flexDirection: 'row', gap: 2, height: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { ...typography.caption },
  dayList: { gap: 10 },
  dayTitle: { ...typography.title },
  empty: { ...typography.body },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  rowDot: { width: 10, height: 10, borderRadius: 5 },
  rowMain: { flex: 1 },
  rowTitle: { ...typography.title },
  rowLine: { ...typography.subhead },
});

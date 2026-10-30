// La fila de chips que filtra una lista larga del área («Todos 47 · 4 EP 19 ·
// 1 ESO 14 · Monitores 6»): se desliza en horizontal y va PEGADA arriba al
// bajar (la lista la pone en `stickyHeaderIndices`). En la puerta del autobús
// es «a ver los de primero, pam; los de segundo, pam».
//
// Una sola en el área: Grupos y fichas (plan 05) y la lista de un evento
// (plan 07) usan esta. El chip elegido va en el acento; uno en aviso, en
// ámbar («Sin grupo»).

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { h } from '@/utils/haptics';
import { useComunicaTheme } from './useComunicaTheme';

export interface FilterChip<K extends string = string> {
  key: K;
  label: string;
  /** Sin número, el chip solo lleva el nombre. */
  count?: number;
  warning?: boolean;
}

export default function FilterChips<K extends string>({
  chips,
  value,
  onChange,
  label,
}: {
  chips: readonly FilterChip<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Lo que dice el lector del grupo («Filtrar por curso»). */
  label: string;
}) {
  const t = useComunicaTheme();
  return (
    <View style={[styles.bar, { backgroundColor: t.backgroundSunken }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        accessibilityRole="tablist"
        accessibilityLabel={label}
      >
        {chips.map((c) => {
          const active = value === c.key;
          const tone = t.chip(c.warning ? 'warning' : 'neutral');
          return (
            <PressableFeedback
              key={c.key}
              onPress={() => {
                h.select();
                onChange(c.key);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={
                c.count === undefined ? c.label : `${c.label}, ${c.count}`
              }
              style={[
                styles.chip,
                {
                  backgroundColor: active ? t.accentFill : tone.background,
                  borderColor: active ? t.accentFill : t.separator,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipLabel,
                  { color: active ? t.onAccent : tone.text },
                ]}
              >
                {c.label}
                {c.count === undefined ? null : (
                  <Text style={styles.chipCount}> {c.count}</Text>
                )}
              </Text>
            </PressableFeedback>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingVertical: 8 },
  chips: { paddingHorizontal: 16, gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  chipLabel: { ...typography.subhead, fontWeight: '600' },
  chipCount: { fontWeight: '400' },
});

// Tarjetas de opción (`stic-option-card` del plugin) con papel de radio: el
// «Automático / Manual» del certificado. Se apilan en el móvil y van en dos
// columnas con `isWide` (iPad, web ancha). La elegida lleva el acento del
// área en el borde, el fondo y la marca; ninguna elegida es `null`.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { h } from '@/utils/haptics';
import { useComunicaTheme } from '../useComunicaTheme';

type IconName = React.ComponentProps<typeof IconSymbol>['name'];

export interface OptionCard<V extends string> {
  value: V;
  title: string;
  description: string;
  icon?: IconName;
}

export default function OptionCards<V extends string>({
  label,
  options,
  value,
  onChange,
}: {
  /** Para el lector de pantalla: qué se elige. */
  label: string;
  options: readonly OptionCard<V>[];
  value: V | null;
  onChange: (v: V) => void;
}) {
  const t = useComunicaTheme();
  const { isWide } = useResponsiveLayout();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.grid, isWide && styles.gridWide]}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <PressableFeedback
            key={o.value}
            onPress={() => {
              h.select();
              onChange(o.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${o.title}. ${o.description}`}
            style={[
              styles.card,
              shadows.card,
              isWide && styles.cardWide,
              {
                backgroundColor: on ? t.chip('accent').background : t.card,
                borderColor: on ? t.accentText : 'transparent',
              },
            ]}
          >
            <PressableFeedback.Highlight />
            <View style={styles.head}>
              {o.icon ? (
                <IconSymbol name={o.icon} size={20} color={t.accentText} />
              ) : null}
              <Text style={[styles.title, { color: t.text }]}>{o.title}</Text>
              <IconSymbol
                name={on ? 'checkmark.circle.fill' : 'circle'}
                size={22}
                color={on ? t.accentText : t.textMuted}
              />
            </View>
            <Text style={[styles.desc, { color: t.textSecondary }]}>
              {o.description}
            </Text>
          </PressableFeedback>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 12 },
  gridWide: { flexDirection: 'row' },
  card: {
    gap: 6,
    padding: 16,
    minHeight: 44,
    borderRadius: radii.lg,
    // El borde está siempre (transparente si no se elige): elegir no mueve
    // nada de sitio.
    borderWidth: 2,
    overflow: 'hidden',
  },
  cardWide: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...typography.title, flex: 1 },
  desc: { ...typography.subhead, lineHeight: 20 },
});

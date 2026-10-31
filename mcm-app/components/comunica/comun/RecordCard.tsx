// La tarjeta de registro del área privada (`stic-rec-*` del plugin, §6.1 de su
// `design.md`): pastilla, título, líneas, cápsula de fecha y UNA acción.
//
// Dos maneras de usarla, nunca las dos a la vez: o se toca la tarjeta entera
// (`onPress`), o lleva un botón (`action`). Un botón que repite lo que hace
// tocar la tarjeta es justo lo que no se envía.
//
// `featured` es la del atajo de la portada («Hoy · C1 · Los Peques»): relleno
// del acento del área. El degradado de la web queda fuera hasta que se decida
// el territorio (`theme.ts`).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { radii, shadows } from '@/constants/uiStyles';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { h } from '@/utils/haptics';
import DateCapsule from './DateCapsule';
import type { ChipTone } from './theme';
import { useComunicaTheme } from './useComunicaTheme';

interface Props {
  /** Pastilla de arriba: «Hoy», «Hace 6 días», «Pasada»… */
  kicker?: { label: string; tone?: ChipTone };
  /** El código en negrita (C1) y el nombre, si aporta (§6.2 de Pasar Lista). */
  code?: string | null;
  title: string;
  lines?: string[];
  day?: string;
  featured?: boolean;
  onPress?: () => void;
  /**
   * Con `onPress`: lo que pasa al tocarla, en el acento y con flecha
   * («Pasar lista ›»). Dice que la tarjeta entera es el enlace sin pintar un
   * botón que lo repita.
   */
  cta?: string;
  action?: { label: string; onPress: () => void };
  accessibilityLabel?: string;
}

export default function RecordCard({
  kicker,
  code,
  title,
  lines = [],
  day,
  featured = false,
  onPress,
  cta,
  action,
  accessibilityLabel,
}: Props) {
  const t = useComunicaTheme();
  const bg = featured ? t.accentFill : t.card;
  const ink = featured ? t.onAccent : t.text;
  const inkSoft = featured ? t.onAccent : t.textSecondary;
  const chip = kicker ? t.chip(kicker.tone ?? 'neutral') : null;
  const a11y =
    accessibilityLabel ??
    [kicker?.label, code, title, ...lines].filter(Boolean).join(', ');

  const body = (
    <>
      <View style={styles.top}>
        <View style={styles.main}>
          {kicker && chip ? (
            <View
              style={[
                styles.kicker,
                {
                  backgroundColor: featured
                    ? t.backgroundSunken
                    : chip.background,
                },
              ]}
            >
              <Text
                style={[
                  styles.kickerLabel,
                  { color: featured ? t.text : chip.text },
                ]}
              >
                {kicker.label}
              </Text>
            </View>
          ) : null}
          <Text
            style={[featured ? styles.titleBig : styles.title, { color: ink }]}
            numberOfLines={2}
          >
            {code ? <Text style={styles.code}>{code}</Text> : null}
            {code && title ? ' · ' : null}
            {title}
          </Text>
          {lines.map((l) => (
            <Text
              key={l}
              style={[styles.line, { color: inkSoft }]}
              numberOfLines={2}
            >
              {l}
            </Text>
          ))}
          {cta && onPress && !action ? (
            <View style={styles.cta}>
              <Text
                style={[
                  styles.ctaLabel,
                  { color: featured ? t.onAccent : t.accentText },
                ]}
              >
                {cta}
              </Text>
              <IconSymbol
                name="chevron.right"
                size={14}
                color={featured ? t.onAccent : t.accentText}
              />
            </View>
          ) : null}
        </View>
        {day ? <DateCapsule day={day} /> : null}
      </View>
      {action ? (
        <PressableFeedback
          onPress={() => {
            h.tap();
            action.onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={[
            styles.action,
            { backgroundColor: featured ? t.card : t.accentFill },
          ]}
        >
          <PressableFeedback.Scale />
          <Text
            style={[
              styles.actionLabel,
              { color: featured ? t.accentText : t.onAccent },
            ]}
          >
            {action.label}
          </Text>
        </PressableFeedback>
      ) : null}
    </>
  );

  const surface = [
    styles.card,
    featured ? shadows.raised : shadows.card,
    { backgroundColor: bg },
  ];

  if (onPress && !action) {
    return (
      <PressableFeedback
        onPress={() => {
          h.tap();
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        style={surface}
      >
        <PressableFeedback.Scale />
        {body}
      </PressableFeedback>
    );
  }
  return (
    <View style={surface} accessibilityLabel={action ? undefined : a11y}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, padding: 16, gap: 16 },
  top: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  main: { flex: 1, gap: 4 },
  kicker: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
    marginBottom: 4,
  },
  kickerLabel: { ...typography.footnote, fontWeight: '700' },
  title: { ...typography.title },
  titleBig: { ...typography.h2 },
  code: { fontWeight: '800' },
  line: { ...typography.subhead },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ctaLabel: { ...typography.button },
  action: {
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  actionLabel: { ...typography.button },
});

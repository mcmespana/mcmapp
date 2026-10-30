// Cápsula de fecha del área privada: día grande y mes en tres letras
// (`stic-rec-*` del plugin). Va en la tarjeta de registro y en las filas de
// «Te faltan N listas».

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radii } from '@/constants/uiStyles';
import typography from '@/constants/typography';
import { capsule, longDay } from '@/utils/comunica/dates';
import { useComunicaTheme } from './useComunicaTheme';

interface Props {
  /** `YYYY-MM-DD`. */
  day: string;
  /** `accent` sobre fondo de acento (tarjeta destacada); `neutral` en listas. */
  tone?: 'accent' | 'neutral';
}

export default function DateCapsule({ day, tone = 'neutral' }: Props) {
  const t = useComunicaTheme();
  const c = capsule(day);
  const onAccent = tone === 'accent';
  return (
    <View
      accessible
      accessibilityLabel={longDay(day)}
      style={[
        styles.box,
        {
          backgroundColor: onAccent ? t.accentFill : t.backgroundSunken,
        },
      ]}
    >
      <Text
        style={[styles.day, { color: onAccent ? t.onAccent : t.text }]}
        maxFontSizeMultiplier={1.3}
      >
        {c.day}
      </Text>
      <Text
        style={[
          styles.month,
          { color: onAccent ? t.onAccent : t.textSecondary },
        ]}
        maxFontSizeMultiplier={1.3}
      >
        {c.month}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 52,
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  day: { ...typography.h3, lineHeight: 22 },
  month: { ...typography.overline },
});

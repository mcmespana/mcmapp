/**
 * Lo cantado, de un vistazo y sin palabras: ocho puntos (las últimas ocho
 * semanas, la de ahora a la derecha) y las veces de este curso.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useColorScheme } from '@/hooks/useColorScheme';
import { describeSongHistory, type SongHistory } from '@/utils/choirHistory';

const DOT = 5;
const EMPTY_WEEKS = new Array<boolean>(8).fill(false);

export default function SungDots({ history }: { history?: SongHistory }) {
  const isDark = useColorScheme() === 'dark';
  const theme = themeColors(isDark);
  const weeks = history?.weeks ?? EMPTY_WEEKS;
  const course = history?.course ?? 0;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="text"
      accessibilityLabel={describeSongHistory(history, Date.now())}
    >
      <View style={styles.dots}>
        {weeks.map((on, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: on ? theme.link : theme.separator },
            ]}
          />
        ))}
      </View>
      <Text
        style={[
          styles.count,
          { color: course ? theme.textSecondary : theme.textMuted },
        ]}
        maxFontSizeMultiplier={1.3}
      >
        {course ? `×${course}` : '—'}
      </Text>
    </View>
  );
}

/** La leyenda, una vez, donde se enciende. */
export function SungLegend() {
  const isDark = useColorScheme() === 'dark';
  const theme = themeColors(isDark);
  return (
    <Text style={[styles.legend, { color: theme.textSecondary }]}>
      Puntos: últimas 8 semanas · ×: veces este curso
    </Text>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: DOT, height: DOT, borderRadius: radii.pillFull },
  count: { ...typography.micro, fontVariant: ['tabular-nums'] },
  legend: { ...typography.footnote },
});
